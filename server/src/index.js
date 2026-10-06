import 'dotenv/config';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool, startDatabase, stopDatabase } from './db.js';
import { seedDatabase } from './seed.js';
import { registerDesk, reserveLines } from './desk.js';
import { customerFrom, registerAccount } from './account.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];

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
  const from = variants.reduce((min, variant) => Math.min(min, variant.pricePaise), variants[0]?.pricePaise || 0);
  const compare = variants.find((variant) => variant.pricePaise === from)?.comparePaise || from;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    featured: row.featured,
    images: row.image_urls || [],
    category: { slug: row.category_slug, name: row.category_name },
    variants,
    fromPricePaise: from,
    fromComparePaise: compare,
  };
}

function requireStaff(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.role) return res.status(401).json({ error: 'Please sign in again.' });
    req.staff = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in again.' });
  }
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
      ) AS items
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
    city: row.city,
    pincode: row.pincode,
    notes: row.notes,
    adminNote: row.admin_note,
    paymentMethod: row.payment_method,
    channel: row.channel || 'online',
    courierName: row.courier_name || '',
    trackingNumber: row.tracking_number || '',
    trackingUrl: row.tracking_url || '',
    status: row.status,
    totalPaise: row.total_paise,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: row.items,
  };
}

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/media', express.static(path.resolve(__dirname, '../../reference/product-images')));
  app.use('/videos', express.static(path.resolve(__dirname, '../../reference/videos')));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/categories', async (_req, res, next) => {
    try {
      const { rows } = await getPool().query(
        `SELECT c.slug, c.name, c.blurb, COUNT(p.id)::int AS count
         FROM categories c
         LEFT JOIN products p ON p.category_id = c.id
         GROUP BY c.id
         ORDER BY c.sort_order`,
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/products', async (req, res, next) => {
    try {
      const params = [];
      let where = '';
      if (req.query.category) {
        params.push(req.query.category);
        where = `WHERE c.slug = $${params.length}`;
      }
      const { rows } = await getPool().query(
        `SELECT p.*, c.slug AS category_slug, c.name AS category_name, ${variantSelect}
         FROM products p
         JOIN categories c ON c.id = p.category_id
         ${where}
         ORDER BY c.sort_order, p.name`,
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
         WHERE p.slug = $1`,
        [req.params.slug],
      );
      if (!rows[0]) return res.status(404).json({ error: 'Product not found.' });
      res.json(mapProduct(rows[0]));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/orders', async (req, res, next) => {
    const body = req.body || {};
    const name = String(body.customerName || '').trim();
    const phone = cleanPhone(body.phone);
    const email = String(body.email || '').trim();
    const addressLine = String(body.addressLine || '').trim();
    const city = String(body.city || '').trim();
    const pincode = String(body.pincode || '').replace(/\D/g, '');
    const notes = String(body.notes || '').trim().slice(0, 500);
    const items = Array.isArray(body.items) ? body.items : [];

    if (name.length < 2) return res.status(400).json({ error: 'Enter the full name.' });
    if (!/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Enter a 10-digit mobile number.' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email, or leave it blank.' });
    if (addressLine.length < 6) return res.status(400).json({ error: 'Enter the delivery address.' });
    if (city.length < 2) return res.status(400).json({ error: 'Enter the city.' });
    if (!/^\d{6}$/.test(pincode)) return res.status(400).json({ error: 'Enter a 6-digit PIN code.' });
    if (items.length === 0) return res.status(400).json({ error: 'Your cart is empty.' });

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
          `SELECT v.id, v.label, v.price_paise, p.name, p.slug, p.image_urls
           FROM variants v
           JOIN products p ON p.id = v.product_id
           WHERE v.id = $1`,
          [variantId],
        );
        if (!found.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'A pack in the cart is no longer available. Refresh and try again.' });
        }
        const row = found.rows[0];
        lines.push({
          variantId: row.id,
          productName: row.name,
          productSlug: row.slug,
          variantLabel: row.label,
          unitPricePaise: row.price_paise,
          quantity,
          imageUrl: row.image_urls?.[0] || '',
        });
      }

      const customer = customerFrom(req);
      const totalPaise = lines.reduce((sum, line) => sum + line.unitPricePaise * line.quantity, 0);
      const tempNumber = `TMP${Date.now()}${Math.floor(Math.random() * 10000)}`;
      const inserted = await client.query(
        `INSERT INTO orders (
           order_number, customer_name, phone, email, address_line, city, pincode, notes, payment_method, status, total_paise, channel, customer_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11, $12)
         RETURNING id`,
        [
          tempNumber,
          name,
          phone,
          email,
          addressLine,
          city,
          pincode,
          notes,
          body.via === 'whatsapp' ? 'whatsapp' : 'cod',
          totalPaise,
          body.via === 'whatsapp' ? 'whatsapp' : 'online',
          customer?.id || null,
        ],
      );
      const id = inserted.rows[0].id;
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
      await client.query('COMMIT');
      res.status(201).json(await orderWithItems(orderNumber));
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      if (error.status === 400) return res.status(400).json({ error: error.message });
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

  app.post('/api/admin/login', async (req, res, next) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const { rows } = await getPool().query('SELECT id, email, name, role, password_hash FROM admins WHERE email = $1', [email]);
      const admin = rows[0];
      if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
        return res.status(401).json({ error: 'Those sign-in details do not match.' });
      }
      const staff = { email: admin.email, name: admin.name, role: admin.role || 'admin' };
      const token = jwt.sign({ id: admin.id, email: admin.email, name: admin.name, role: staff.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, staff });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/summary', requireStaff, async (_req, res, next) => {
    try {
      const { rows } = await getPool().query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
           COUNT(*) FILTER (WHERE status IN ('confirmed', 'packed', 'shipped'))::int AS open,
           COALESCE(SUM(total_paise) FILTER (WHERE status <> 'cancelled'), 0)::int AS revenue_paise
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
        `SELECT o.order_number, o.customer_name, o.phone, o.city, o.status, o.channel, o.total_paise, o.created_at,
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

  registerAccount(app);
  registerDesk(app, { requireStaff, allow, orderWithItems, cleanPhone, STATUSES });

  const dist = path.resolve(__dirname, '../../client/dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/media')) return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use((error, _req, res, _next) => {
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'That file is too large. Photos are 8 MB and videos are 40 MB.' });
    if (error.status && error.status < 500) return res.status(error.status).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}

const app = createApp();
const port = Number(process.env.PORT || 4000);

startDatabase()
  .then((pool) => seedDatabase(pool))
  .then(() => {
    const server = app.listen(port, () => {
      console.log(`Jagatha API ready at http://127.0.0.1:${port}`);
    });
    const shutdown = async () => {
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
