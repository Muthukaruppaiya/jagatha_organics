import 'dotenv/config';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { getPool, startDatabase, stopDatabase } from './db.js';
import { seedDatabase } from './seed.js';
import { addEvent, registerDesk, reserveLines, restoreLines } from './desk.js';
import { sendOrderConfirmed } from './whatsapp.js';
import { customerFrom, registerAccount } from './account.js';
import { createRazorpayOrder, demoEnabled, paymentKeys, paymentMode, validSignature, validWebhook } from './payments.js';
import { readAddress } from './address.js';
import { cartGrams, loadShippingRules, shippingPaise } from './shipping.js';
import { registerSettings } from './settings.js';
import {
  clearStaffCookie,
  jwtSecret,
  readStaffToken,
  setStaffCookie,
  signStaffToken,
} from './session.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const PLACEHOLDER = '/placeholder-product.svg';
const PAYMENT_WINDOW_MINUTES = 30;

const variantSelect = `
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', v.id,
          'label', v.label,
          'weightGrams', v.weight_grams,
          'pricePaise', v.price_paise,
          'comparePaise', v.compare_paise,
          'stockQty', v.stock_qty
        )
        ORDER BY v.weight_grams
      )
      FROM variants v
      WHERE v.product_id = p.id
    ),
    '[]'::json
  ) AS variants
`;

function mapProduct(row) {
  const variants = row.variants || [];
  const lightest = [...variants].sort((a, b) => (a.weightGrams || 0) - (b.weightGrams || 0))[0];
  const from = lightest?.pricePaise || 0;
  const compare = lightest?.comparePaise || from;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    featured: row.featured,
    images: row.image_urls?.length ? row.image_urls : [PLACEHOLDER],
    category: { slug: row.category_slug, name: row.category_name },
    variants,
    fromLabel: lightest?.label || '',
    fromPricePaise: from,
    fromComparePaise: compare,
  };
}

function requireStaff(req, res, next) {
  const payload = readStaffToken(req);
  if (!payload) return res.status(401).json({ error: 'Please sign in again.' });
  req.staff = payload;
  next();
}

function allow(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.staff.role)) {
      return res.status(403).json({ error: 'This desk is not open for your role.' });
    }
    next();
  };
}

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
}

async function orderWithItems(orderNumber) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT o.*,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'productName', i.product_name,
              'productSlug', i.product_slug,
              'variantLabel', i.variant_label,
              'unitPricePaise', i.unit_price_paise,
              'quantity', i.quantity,
              'imageUrl', i.image_url
            )
            ORDER BY i.id
          )
          FROM order_items i
          WHERE i.order_id = o.id
        ),
        '[]'::json
      ) AS items,
      COALESCE(
        (
          SELECT json_agg(json_build_object('status', e.status, 'note', e.note, 'at', e.created_at) ORDER BY e.created_at, e.id)
          FROM order_events e
          WHERE e.order_id = o.id
        ),
        '[]'::json
      ) AS events
     FROM orders o
     WHERE o.order_number = $1`,
    [orderNumber],
  );
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    orderNumber: row.order_number,
    customerName: row.customer_name,
    phone: row.phone,
    email: row.email,
    addressLine: row.address_line,
    locality: row.locality || '',
    landmark: row.landmark || '',
    city: row.city,
    state: row.state || '',
    pincode: row.pincode,
    altPhone: row.alt_phone || '',
    addressType: row.address_type || '',
    events: row.events,
    notes: row.notes,
    adminNote: row.admin_note,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status || '',
    channel: row.channel || 'online',
    courierName: row.courier_name || '',
    trackingNumber: row.tracking_number || '',
    trackingUrl: row.tracking_url || '',
    status: row.status,
    shippingPaise: row.shipping_paise || 0,
    totalPaise: row.total_paise,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: row.items,
  };
}

function notifyConfirmed(order) {
  if (!order?.phone) return;
  sendOrderConfirmed({
    phone: order.phone,
    name: order.customerName || order.customer_name,
    orderNumber: order.orderNumber || order.order_number,
    totalPaise: order.totalPaise ?? order.total_paise,
  }).catch((error) => console.error('WhatsApp order message failed:', error.message));
}

async function markPaymentCaptured(client, order, paymentId, extraNote = '') {
  if (order.payment_status === 'paid') return false;
  let note = extraNote;
  if (order.status === 'cancelled') {
    const { rows: lines } = await client.query(
      'SELECT variant_id AS "variantId", quantity FROM order_items WHERE order_id = $1 AND variant_id IS NOT NULL',
      [order.id],
    );
    await client.query('SAVEPOINT restock');
    try {
      await reserveLines(client, lines, { orderId: order.id, reason: 'sale', staffEmail: '' });
    } catch {
      await client.query('ROLLBACK TO SAVEPOINT restock');
      note = 'Paid after the payment window closed and some packs are now out of stock. Check stock before packing.';
    }
  }
  await client.query(
    `UPDATE orders
     SET payment_status = 'paid', razorpay_payment_id = $2,
         status = CASE WHEN status IN ('pending', 'cancelled') THEN 'confirmed' ELSE status END,
         admin_note = CASE WHEN $3 = '' THEN admin_note ELSE TRIM(admin_note || ' ' || $3) END,
         updated_at = NOW()
     WHERE id = $1`,
    [order.id, paymentId, note],
  );
  await addEvent(client, order.id, 'confirmed', 'Payment received');
  return true;
}

function authLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many tries. Wait a few minutes and try again.' },
  });
}

function createApp() {
  jwtSecret();
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: false,
  }));
  const allowedOrigins = new Set(
    [
      process.env.PUBLIC_ORIGIN,
      'http://103.94.27.120',
      'http://jagathaorganics.com',
      'https://jagathaorganics.com',
      'http://www.jagathaorganics.com',
      'https://www.jagathaorganics.com',
    ].flatMap((value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean)),
  );
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  }));
  app.use(cookieParser());
  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    max: 240,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health',
    message: { error: 'Too many requests. Please wait a moment.' },
  }));
  app.use((req, res, next) => {
    const pathName = req.originalUrl.split('?')[0];
    if (pathName === '/api/payments/razorpay-webhook') {
      return express.raw({ type: 'application/json' })(req, res, next);
    }
    if (!/json/i.test(req.headers['content-type'] || '')) return next();
    return express.json({ limit: '200kb' })(req, res, next);
  });
  app.use('/media', express.static(path.resolve(__dirname, '../../reference/product-images')));
  app.use('/videos', express.static(path.resolve(__dirname, '../../reference/videos')));
  app.use('/banner-images', express.static(path.resolve(__dirname, '../../reference/banners')));
  const reelsDir = path.resolve(__dirname, '../../client/public/reels');
  if (existsSync(reelsDir)) app.use('/reels', express.static(reelsDir));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, payments: paymentMode() });
  });

  app.get('/api/categories', async (_req, res, next) => {
    try {
      const { rows } = await getPool().query(
        `SELECT c.slug, c.name, c.blurb, COUNT(p.id)::int AS count
         FROM categories c
         LEFT JOIN products p ON p.category_id = c.id AND p.active
         GROUP BY c.id
         ORDER BY c.sort_order, c.id`,
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/products', async (req, res, next) => {
    try {
      const params = [];
      let where = 'WHERE p.active';
      if (req.query.category) {
        params.push(req.query.category);
        where += ` AND c.slug = $${params.length}`;
      }
      const { rows } = await getPool().query(
        `SELECT p.*, c.slug AS category_slug, c.name AS category_name, ${variantSelect}
         FROM products p
         JOIN categories c ON c.id = p.category_id
         ${where}
         ORDER BY c.sort_order, p.sort_order, p.name`,
        params,
      );
      res.json(rows.map(mapProduct));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/products/:slug', async (req, res, next) => {
    try {
      const { rows } = await getPool().query(
        `SELECT p.*, c.slug AS category_slug, c.name AS category_name, ${variantSelect}
         FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE p.slug = $1 AND p.active`,
        [req.params.slug],
      );
      if (!rows[0]) return res.status(404).json({ error: 'Product not found.' });
      res.json(mapProduct(rows[0]));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/orders', authLimit(), async (req, res, next) => {
    const customer = customerFrom(req);
    if (!customer) {
      return res.status(401).json({ error: 'Sign in with your mobile number to place an order.' });
    }
    const body = req.body || {};
    let address;
    try {
      address = readAddress(body);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const email = String(body.email || '').trim();
    const notes = String(body.notes || '').trim().slice(0, 500);
    const items = Array.isArray(body.items) ? body.items : [];

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email, or leave it blank.' });
    if (items.length === 0) return res.status(400).json({ error: 'Your cart is empty.' });
    const keys = paymentKeys();
    const demo = demoEnabled();
    if (!keys && !demo) {
      return res.status(503).json({ error: 'Online payment is not switched on yet. Please message us on WhatsApp at +91 98841 26032 to order.' });
    }

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const lines = [];
      for (const item of items) {
        const quantity = Number(item.quantity);
        const variantId = Number(item.variantId);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Each pack quantity must be between 1 and 20.' });
        }
        const found = await client.query(
          `SELECT v.id, v.label, v.price_paise, v.weight_grams, p.name, p.slug, p.image_urls
           FROM variants v
           JOIN products p ON p.id = v.product_id
           WHERE v.id = $1 AND p.active`,
          [variantId],
        );
        if (!found.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'A pack in the cart is no longer available. Remove it from the cart and try again.' });
        }
        const row = found.rows[0];
        lines.push({
          variantId: row.id,
          productName: row.name,
          productSlug: row.slug,
          variantLabel: row.label,
          unitPricePaise: row.price_paise,
          grams: row.weight_grams,
          quantity,
          imageUrl: row.image_urls?.[0] || '',
        });
      }

      const goodsPaise = lines.reduce((sum, line) => sum + line.unitPricePaise * line.quantity, 0);
      const shipRules = await loadShippingRules(getPool());
      const shipPaise = shippingPaise({ pincode: address.pincode, state: address.state, grams: cartGrams(lines) }, shipRules);
      const totalPaise = goodsPaise + shipPaise;
      const tempNumber = `TMP${Date.now()}${Math.floor(Math.random() * 10000)}`;
      const inserted = await client.query(
        `INSERT INTO orders (
           order_number, customer_name, phone, email, address_line, city, pincode, notes,
           locality, state, landmark, alt_phone, address_type,
           payment_method, payment_status, status, total_paise, shipping_paise, channel, customer_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'awaiting', 'pending', $15, $16, 'online', $17)
         RETURNING id`,
        [
          tempNumber, address.name, address.phone, email, address.addressLine, address.city, address.pincode, notes,
          address.locality, address.state, address.landmark, address.altPhone, address.addressType,
          demo ? 'demo' : 'online', totalPaise, shipPaise, customer?.id || null,
        ],
      );
      const id = inserted.rows[0].id;
      await addEvent(client, id, 'pending', 'Order placed');
      if (customer && Number(body.addressId)) {
        await client.query('UPDATE customer_addresses SET used_at = NOW() WHERE id = $1 AND customer_id = $2', [Number(body.addressId), customer.id]);
      }
      const orderNumber = `JO${1000 + id}`;
      await client.query('UPDATE orders SET order_number = $1 WHERE id = $2', [orderNumber, id]);
      for (const line of lines) {
        await client.query(
          `INSERT INTO order_items (order_id, variant_id, product_name, product_slug, variant_label, unit_price_paise, quantity, image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, line.variantId, line.productName, line.productSlug, line.variantLabel, line.unitPricePaise, line.quantity, line.imageUrl],
        );
      }
      await reserveLines(client, lines, { orderId: id, reason: 'sale', staffEmail: '' });
      let payment = { demo: true, amountPaise: totalPaise, currency: 'INR' };
      if (!demo) {
        const razorpayOrder = await createRazorpayOrder({
          amountPaise: totalPaise,
          receipt: orderNumber,
          notes: { order: orderNumber, phone: address.phone, pincode: address.pincode },
        });
        await client.query('UPDATE orders SET razorpay_order_id = $1 WHERE id = $2', [razorpayOrder.id, id]);
        payment = {
          keyId: keys.keyId,
          razorpayOrderId: razorpayOrder.id,
          amountPaise: totalPaise,
          currency: 'INR',
        };
      }
      await client.query('COMMIT');
      res.status(201).json({
        order: await orderWithItems(orderNumber),
        payment,
      });
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      if (error.status === 400 || error.status === 502) return res.status(error.status).json({ error: error.message });
      next(error);
    } finally {
      client.release();
    }
  });

  app.post('/api/orders/:orderNumber/demo-pay', async (req, res, next) => {
    if (!demoEnabled()) {
      return res.status(403).json({ error: 'Test payment is only available on this local shop.' });
    }
    const orderNumber = String(req.params.orderNumber || '').toUpperCase();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const found = await client.query(
        `SELECT id, status, payment_status, razorpay_order_id
         FROM orders WHERE order_number = $1 AND payment_method = 'demo' FOR UPDATE`,
        [orderNumber],
      );
      const order = found.rows[0];
      if (!order) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'No test order is waiting for that number.' });
      }
      const confirmed = await markPaymentCaptured(client, order, 'demo');
      await client.query('COMMIT');
      const { adminNote, ...paid } = await orderWithItems(orderNumber);
      if (confirmed) notifyConfirmed(paid);
      res.json(paid);
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      next(error);
    } finally {
      client.release();
    }
  });

  app.post('/api/payments/razorpay-webhook', async (req, res, next) => {
    try {
      const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
      if (!validWebhook(raw, req.headers['x-razorpay-signature'])) {
        return res.status(400).json({ error: 'Invalid webhook signature.' });
      }
      const event = JSON.parse(raw.toString('utf8'));
      if (event.event !== 'payment.captured' && event.event !== 'order.paid') {
        return res.json({ ok: true });
      }
      const payment = event.payload?.payment?.entity || {};
      const razorpayOrderId = payment.order_id || event.payload?.order?.entity?.id || '';
      const paymentId = payment.id || '';
      if (!razorpayOrderId || !paymentId) return res.json({ ok: true });
      const client = await getPool().connect();
      try {
        await client.query('BEGIN');
        const found = await client.query(
          'SELECT id, status, payment_status, razorpay_order_id FROM orders WHERE razorpay_order_id = $1 FOR UPDATE',
          [razorpayOrderId],
        );
        const order = found.rows[0];
        const confirmed = order ? await markPaymentCaptured(client, order, paymentId) : false;
        await client.query('COMMIT');
        if (confirmed) {
          const paid = await getPool().query(
            'SELECT order_number, customer_name, phone, total_paise FROM orders WHERE id = $1',
            [order.id],
          );
          notifyConfirmed(paid.rows[0]);
        }
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        throw error;
      } finally {
        client.release();
      }
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/orders/:orderNumber/pay', async (req, res, next) => {
    const orderNumber = String(req.params.orderNumber || '').toUpperCase();
    const paymentId = String(req.body?.razorpayPaymentId || '');
    const razorpayOrderId = String(req.body?.razorpayOrderId || '');
    const signature = String(req.body?.razorpaySignature || '');
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const found = await client.query(
        'SELECT id, status, payment_status, razorpay_order_id FROM orders WHERE order_number = $1 FOR UPDATE',
        [orderNumber],
      );
      const order = found.rows[0];
      if (!order || !order.razorpay_order_id || order.razorpay_order_id !== razorpayOrderId) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'No payment is waiting for that order.' });
      }
      if (!validSignature(razorpayOrderId, paymentId, signature)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'We could not confirm this payment. If money was taken, message us on WhatsApp with the order number.' });
      }
      const confirmed = await markPaymentCaptured(client, order, paymentId);
      await client.query('COMMIT');
      const { adminNote, ...paid } = await orderWithItems(orderNumber);
      if (confirmed) notifyConfirmed(paid);
      res.json(paid);
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      next(error);
    } finally {
      client.release();
    }
  });

  app.get('/api/orders/track', async (req, res, next) => {
    try {
      const orderNumber = String(req.query.number || '').trim().toUpperCase();
      const phone = cleanPhone(req.query.phone);
      if (!orderNumber || !/^\d{10}$/.test(phone)) {
        return res.status(400).json({ error: 'Enter the order number and the 10-digit phone used at checkout.' });
      }
      const order = await orderWithItems(orderNumber);
      if (!order || order.phone !== phone) return res.status(404).json({ error: 'No order matches that number and phone.' });
      const { adminNote, ...publicOrder } = order;
      res.json(publicOrder);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/login', authLimit(), async (req, res, next) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const { rows } = await getPool().query('SELECT id, email, name, role, password_hash FROM admins WHERE email = $1', [email]);
      const admin = rows[0];
      if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
        return res.status(401).json({ error: 'Those sign-in details do not match.' });
      }
      const { token, staff } = signStaffToken(admin);
      setStaffCookie(res, token);
      res.json({ staff });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/me', requireStaff, (req, res) => {
    const { id, email, name, role } = req.staff;
    res.json({ id, email, name, role });
  });

  app.post('/api/admin/logout', (_req, res) => {
    clearStaffCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/admin/summary', requireStaff, async (_req, res, next) => {
    try {
      const { rows } = await getPool().query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
           COUNT(*) FILTER (WHERE status IN ('confirmed', 'packed', 'shipped'))::int AS open,
           COALESCE(SUM(total_paise) FILTER (WHERE status <> 'cancelled' AND payment_status NOT IN ('awaiting', 'expired')), 0)::int AS revenue_paise
         FROM orders`,
      );
      res.json({
        total: rows[0].total,
        pending: rows[0].pending,
        open: rows[0].open,
        revenuePaise: rows[0].revenue_paise,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/orders', requireStaff, async (req, res, next) => {
    try {
      const status = STATUSES.includes(req.query.status) ? req.query.status : null;
      const q = String(req.query.q || '').trim();
      const params = [];
      const where = [];
      if (status) {
        params.push(status);
        where.push(`o.status = $${params.length}`);
      }
      if (q) {
        params.push(`%${q}%`);
        where.push(`(o.order_number ILIKE $${params.length} OR o.customer_name ILIKE $${params.length} OR o.phone ILIKE $${params.length})`);
      }
      const { rows } = await getPool().query(
        `SELECT o.order_number, o.customer_name, o.phone, o.city, o.status, o.channel, o.payment_status, o.total_paise, o.created_at,
           (SELECT COUNT(*)::int FROM order_items i WHERE i.order_id = o.id) AS item_count
         FROM orders o
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY o.created_at DESC`,
        params,
      );
      res.json(rows.map((row) => ({
        orderNumber: row.order_number,
        customerName: row.customer_name,
        phone: row.phone,
        city: row.city,
        status: row.status,
        channel: row.channel || 'online',
        paymentStatus: row.payment_status || '',
        totalPaise: row.total_paise,
        createdAt: row.created_at,
        itemCount: row.item_count,
      })));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/orders/:orderNumber', requireStaff, async (req, res, next) => {
    try {
      const order = await orderWithItems(String(req.params.orderNumber).toUpperCase());
      if (!order) return res.status(404).json({ error: 'Order not found.' });
      res.json(order);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/videos', async (_req, res, next) => {
    try {
      const { rows } = await getPool().query('SELECT id, title, src FROM videos ORDER BY sort_order, id');
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/banners', async (_req, res, next) => {
    try {
      const { rows } = await getPool().query(
        `SELECT b.id, b.title, b.subtitle, b.button_label, b.link_url, b.image_url, b.mobile_image_url,
                b.pack_label, b.price_paise AS offer_price_paise, b.compare_paise AS offer_compare_paise,
                p.slug AS product_slug, p.name AS product_name, p.image_urls[1] AS product_image,
                v.id AS variant_id, v.label AS variant_label, v.price_paise, v.compare_paise, v.stock_qty
         FROM banners b
         LEFT JOIN products p ON p.slug = b.product_slug AND p.active
         LEFT JOIN LATERAL (
           SELECT * FROM variants
           WHERE product_id = p.id
           ORDER BY (label = b.variant_label) DESC, weight_grams
           LIMIT 1
         ) v ON TRUE
         WHERE b.active
         ORDER BY b.sort_order, b.id`,
      );
      res.json(rows.map((row) => {
        const packLabel = row.pack_label || row.variant_label || '';
        const pricePaise = row.offer_price_paise || row.price_paise || 0;
        const comparePaise = row.offer_compare_paise || row.compare_paise || 0;
        return {
          id: row.id,
          title: row.title,
          subtitle: row.subtitle,
          buttonLabel: row.button_label,
          link: row.link_url,
          image: row.image_url,
          mobileImage: row.mobile_image_url || '',
          packLabel,
          pricePaise,
          comparePaise,
          product: row.variant_id
            ? {
              slug: row.product_slug,
              name: row.product_name,
              image: row.product_image || row.image_url,
              variantId: row.variant_id,
              label: packLabel || row.variant_label,
              pricePaise,
              comparePaise,
              stockQty: row.stock_qty,
            }
            : (pricePaise || packLabel)
              ? {
                slug: '',
                name: row.title,
                image: row.image_url,
                variantId: 0,
                label: packLabel,
                pricePaise,
                comparePaise,
                stockQty: 1,
              }
              : null,
        };
      }));
    } catch (error) {
      next(error);
    }
  });

  registerAccount(app);
  registerDesk(app, { requireStaff, allow, orderWithItems, cleanPhone, STATUSES });
  registerSettings(app, { requireStaff, allow });

  const dist = path.resolve(__dirname, '../../client/dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res, next) => {
      if (/^\/(api|media|videos|banner-images|reels)(\/|$)/.test(req.path)) return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use((error, _req, res, _next) => {
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'That file is too large. Photos are 8 MB and videos are 25 MB.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large.' });
    if (error.status && error.status < 500) return res.status(error.status).json({ error: error.message });
    if (error.status === 503) return res.status(503).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}

async function expireUnpaidOrders() {
  const { rows } = await getPool().query(
    `SELECT id FROM orders
     WHERE payment_status = 'awaiting' AND status = 'pending'
       AND created_at < NOW() - make_interval(mins => $1)`,
    [PAYMENT_WINDOW_MINUTES],
  );
  for (const row of rows) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query(
        `SELECT id FROM orders WHERE id = $1 AND payment_status = 'awaiting' AND status = 'pending' FOR UPDATE`,
        [row.id],
      );
      if (locked.rows[0]) {
        await restoreLines(client, row.id, 'payment window closed');
        await client.query(
          `UPDATE orders SET status = 'cancelled', payment_status = 'expired', updated_at = NOW() WHERE id = $1`,
          [row.id],
        );
        await addEvent(client, row.id, 'cancelled', 'Payment not completed');
      }
      await client.query('COMMIT');
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      console.error('Could not expire unpaid order', row.id, error.message);
    } finally {
      client.release();
    }
  }
}

const app = createApp();
const port = Number(process.env.PORT || 4100);

startDatabase()
  .then((pool) => seedDatabase(pool))
  .then(() => {
    const server = app.listen(port, () => {
      console.log(`Jagatha API ready at http://127.0.0.1:${port}`);
      const mode = paymentMode();
      if (mode === 'live') console.log('Razorpay live payments are on.');
      else if (mode === 'test') console.log('Razorpay test keys are loaded. Use rzp_live_ keys for real charges.');
      else if (mode === 'demo') console.log('Test payments are on: checkout can confirm an order without Razorpay.');
      else console.log('Online payment is off: add live RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to server/.env.');
    });
    const sweep = setInterval(() => expireUnpaidOrders().catch((error) => console.error(error)), 5 * 60 * 1000);
    expireUnpaidOrders().catch((error) => console.error(error));
    const shutdown = async () => {
      clearInterval(sweep);
      server.close();
      await stopDatabase();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
