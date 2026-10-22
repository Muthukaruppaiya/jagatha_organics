import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { getPool } from './db.js';
import { registerReviewDesk } from './account.js';
import { registerProductDesk } from './products.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imageRoot = path.resolve(__dirname, '../../reference/product-images');
const videoRoot = path.resolve(__dirname, '../../reference/videos');
const bannerRoot = path.resolve(__dirname, '../../reference/banners');

function imageUpload(dirFor) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => {
        const dir = dirFor();
        fs.mkdirSync(dir, { recursive: true });
        callback(null, dir);
      },
      filename: (_req, file, callback) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safe = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
        callback(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safe === '.jpeg' ? '.jpg' : safe}`);
      },
    }),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
      if (!/^image\/(jpeg|jpg|png|webp)$/.test(file.mimetype)) {
        const error = new Error('Upload a JPG, PNG, or WebP image.');
        error.status = 400;
        callback(error);
        return;
      }
      callback(null, true);
    },
  });
}

const upload = imageUpload(() => path.join(imageRoot, 'uploads'));
const bannerUpload = imageUpload(() => bannerRoot);

function bannerLink(value) {
  const link = clip(value, 300);
  if (!link) return '';
  if (link.startsWith('/') && !link.startsWith('//')) return link;
  if (/^https?:\/\//i.test(link)) return link;
  const error = new Error('Button link must start with / for a page on this site, or with https:// for another site.');
  error.status = 400;
  throw error;
}

function removeBannerFile(url) {
  if (!String(url).startsWith('/banner-images/')) return;
  const file = path.resolve(bannerRoot, path.basename(String(url)));
  if (file.startsWith(bannerRoot) && fs.existsSync(file)) fs.unlinkSync(file);
}

function mapBanner(row) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    buttonLabel: row.button_label,
    link: row.link_url,
    image: row.image_url,
    productSlug: row.product_slug,
    variantLabel: row.variant_label,
    active: row.active,
    sortOrder: row.sort_order,
  };
}

async function bannerProduct(body) {
  const slug = clip(body?.productSlug, 120);
  if (!slug) return { slug: '', label: '', image: '' };
  const { rows } = await getPool().query(
    `SELECT v.label, p.image_urls[1] AS image FROM variants v JOIN products p ON p.id = v.product_id WHERE p.slug = $1 ORDER BY v.weight_grams`,
    [slug],
  );
  if (!rows.length) {
    const error = new Error('That product is not on the shelf.');
    error.status = 400;
    throw error;
  }
  const wanted = clip(body?.variantLabel, 40);
  const label = rows.some((row) => row.label === wanted) ? wanted : rows[0].label;
  return { slug, label, image: rows[0].image || '' };
}

function clip(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function httpUrl(value) {
  const url = clip(value, 300);
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    const error = new Error('Courier link must start with http:// or https://.');
    error.status = 400;
    throw error;
  }
  return url;
}

export async function addEvent(client, orderId, status, note = '') {
  await client.query('INSERT INTO order_events (order_id, status, note) VALUES ($1, $2, $3)', [orderId, status, note]);
}

export async function reserveLines(client, lines, { orderId, reason, staffEmail }) {
  for (const line of lines) {
    const updated = await client.query(
      `UPDATE variants
       SET stock_qty = stock_qty - $2
       WHERE id = $1 AND stock_qty >= $2
       RETURNING stock_qty`,
      [line.variantId, line.quantity],
    );
    if (!updated.rows[0]) {
      const current = await client.query(
        `SELECT v.stock_qty, v.label, p.name
         FROM variants v
         JOIN products p ON p.id = v.product_id
         WHERE v.id = $1`,
        [line.variantId],
      );
      const row = current.rows[0];
      const left = row?.stock_qty ?? 0;
      const label = `${row?.name || 'A pack'} ${row?.label || ''}`.trim();
      const error = new Error(left <= 0 ? `${label} is out of stock.` : `Only ${left} left for ${label}.`);
      error.status = 400;
      throw error;
    }
    await client.query(
      `INSERT INTO inventory_moves (variant_id, order_id, quantity_delta, reason, note, staff_email)
       VALUES ($1, $2, $3, $4, '', $5)`,
      [line.variantId, orderId, -line.quantity, reason, staffEmail || ''],
    );
  }
}

export async function restoreLines(client, orderId, staffEmail) {
  const { rows } = await client.query(
    `SELECT variant_id, quantity, product_name, variant_label
     FROM order_items
     WHERE order_id = $1 AND variant_id IS NOT NULL`,
    [orderId],
  );
  for (const row of rows) {
    await client.query('UPDATE variants SET stock_qty = stock_qty + $2 WHERE id = $1', [row.variant_id, row.quantity]);
    await client.query(
      `INSERT INTO inventory_moves (variant_id, order_id, quantity_delta, reason, note, staff_email)
       VALUES ($1, $2, $3, 'cancel_return', $4, $5)`,
      [row.variant_id, orderId, row.quantity, `${row.product_name} ${row.variant_label}`, staffEmail || ''],
    );
  }
}

async function pricedLines(client, items, maxQty) {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error('Add at least one pack.');
    error.status = 400;
    throw error;
  }
  const lines = [];
  for (const item of items) {
    const quantity = Number(item.quantity);
    const variantId = Number(item.variantId);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxQty) {
      const error = new Error(`Each pack quantity must be between 1 and ${maxQty}.`);
      error.status = 400;
      throw error;
    }
    const found = await client.query(
      `SELECT v.id, v.label, v.price_paise, p.name, p.slug, p.image_urls
       FROM variants v
       JOIN products p ON p.id = v.product_id
       WHERE v.id = $1`,
      [variantId],
    );
    if (!found.rows[0]) {
      const error = new Error('A pack in the bill is no longer available. Refresh and try again.');
      error.status = 400;
      throw error;
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
  return lines;
}

function safeImageFile(url) {
  if (!String(url).startsWith('/media/')) return null;
  const relative = decodeURIComponent(String(url).slice('/media/'.length));
  if (relative.includes('..')) return null;
  const root = path.resolve(imageRoot);
  const file = path.resolve(imageRoot, relative);
  const rootKey = root.toLowerCase().endsWith(path.sep) ? root.toLowerCase() : `${root.toLowerCase()}${path.sep}`;
  if (!file.toLowerCase().startsWith(rootKey) && file.toLowerCase() !== root.toLowerCase()) return null;
  return file;
}

const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      fs.mkdirSync(videoRoot, { recursive: true });
      callback(null, videoRoot);
    },
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname).toLowerCase() === '.mp4' ? '.mp4' : '.mp4';
      callback(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'video/mp4') {
      const error = new Error('Upload an MP4 video.');
      error.status = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

export function registerDesk(app, { requireStaff, allow, orderWithItems, cleanPhone, STATUSES }) {
  registerReviewDesk(app, { requireStaff, allow });
  registerProductDesk(app, { requireStaff, allow });
  app.get('/api/admin/inventory', requireStaff, allow('admin', 'billing'), async (_req, res, next) => {
    try {
      const { rows } = await getPool().query(
        `SELECT p.name, p.slug, c.name AS category, v.id, v.label, v.stock_qty, v.price_paise, p.image_urls[1] AS image_url
         FROM variants v
         JOIN products p ON p.id = v.product_id
         JOIN categories c ON c.id = p.category_id
         ORDER BY c.sort_order, c.id, p.sort_order, p.name, v.weight_grams`,
      );
      res.json(rows.map((row) => ({
        variantId: row.id,
        productName: row.name,
        productSlug: row.slug,
        category: row.category,
        label: row.label,
        stockQty: row.stock_qty,
        pricePaise: row.price_paise,
        imageUrl: row.image_url || '',
      })));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/inventory', requireStaff, allow('admin', 'billing'), async (req, res, next) => {
    const variantId = Number(req.body?.variantId);
    const quantity = Number(req.body?.quantity);
    const note = clip(req.body?.note, 200);
    if (!Number.isInteger(variantId) || variantId < 1) return res.status(400).json({ error: 'Choose a pack.' });
    if (!Number.isInteger(quantity) || quantity === 0 || quantity < -500 || quantity > 500) {
      return res.status(400).json({ error: 'Enter a quantity from -500 to 500, other than zero.' });
    }
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE variants
         SET stock_qty = stock_qty + $2
         WHERE id = $1 AND stock_qty + $2 >= 0
         RETURNING stock_qty, label`,
        [variantId, quantity],
      );
      if (!updated.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'That would take the stock below zero.' });
      }
      await client.query(
        `INSERT INTO inventory_moves (variant_id, quantity_delta, reason, note, staff_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [variantId, quantity, quantity > 0 ? 'receive' : 'adjust', note, req.staff.email],
      );
      await client.query('COMMIT');
      res.json({ variantId, stockQty: updated.rows[0].stock_qty, label: updated.rows[0].label });
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      next(error);
    } finally {
      client.release();
    }
  });

  app.post('/api/admin/products/:slug/images', requireStaff, allow('admin'), upload.single('image'), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Choose an image.' });
      const slug = String(req.params.slug || '');
      const found = await getPool().query(
        `SELECT p.slug, c.slug AS category
         FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE p.slug = $1`,
        [slug],
      );
      if (!found.rows[0]) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Product not found.' });
      }
      const category = found.rows[0].category;
      const folder = category === 'gift-boxes' ? 'combo' : category;
      const dir = path.join(imageRoot, folder);
      fs.mkdirSync(dir, { recursive: true });
      const ext = path.extname(req.file.filename).toLowerCase();
      const pattern = new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)\\.`, 'i');
      let nextIndex = 1;
      for (const file of fs.readdirSync(dir)) {
        const match = file.match(pattern);
        if (match) nextIndex = Math.max(nextIndex, Number(match[1]) + 1);
      }
      const filename = `${slug}-${nextIndex}${ext}`;
      fs.renameSync(req.file.path, path.join(dir, filename));
      const url = `/media/${folder}/${filename}`;
      const updated = await getPool().query(
        `UPDATE products SET image_urls = image_urls || $2::text[] WHERE slug = $1 RETURNING image_urls`,
        [slug, [url]],
      );
      res.status(201).json({ images: updated.rows[0].image_urls });
    } catch (error) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      next(error);
    }
  });

  app.delete('/api/admin/products/:slug/images', requireStaff, allow('admin'), async (req, res, next) => {
    try {
      const slug = String(req.params.slug || '');
      const url = String(req.body?.url || '');
      const file = safeImageFile(url);
      if (!file) return res.status(400).json({ error: 'That image cannot be removed.' });
      const found = await getPool().query(
        `SELECT image_urls FROM products WHERE slug = $1`,
        [slug],
      );
      if (!found.rows[0]) return res.status(404).json({ error: 'Product not found.' });
      const images = found.rows[0].image_urls || [];
      if (!images.includes(url)) {
        return res.status(400).json({ error: 'That image is not on this product.' });
      }
      const updated = await getPool().query(
        `UPDATE products
         SET image_urls = array_remove(image_urls, $2)
         WHERE slug = $1
         RETURNING image_urls`,
        [slug, url],
      );
      if (fs.existsSync(file)) fs.unlinkSync(file);
      res.json({ images: updated.rows[0].image_urls });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/reports', requireStaff, allow('admin', 'billing'), async (req, res, next) => {
    try {
      const today = new Date();
      const defaultFrom = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
      const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from || '')) ? String(req.query.from) : defaultFrom.toISOString().slice(0, 10);
      const to = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to || '')) ? String(req.query.to) : today.toISOString().slice(0, 10);
      const pool = getPool();
      const totals = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status <> 'cancelled' AND payment_status <> 'awaiting' AND channel = 'online')::int AS online_orders,
           COUNT(*) FILTER (WHERE status <> 'cancelled' AND payment_status <> 'awaiting' AND channel = 'whatsapp')::int AS whatsapp_orders,
           COUNT(*) FILTER (WHERE status <> 'cancelled' AND payment_status <> 'awaiting' AND channel = 'store')::int AS store_bills,
           COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
           COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS paid_orders,
           COUNT(*) FILTER (WHERE payment_status = 'awaiting')::int AS awaiting_orders,
           COALESCE(SUM(total_paise) FILTER (WHERE status <> 'cancelled' AND payment_status <> 'awaiting' AND channel = 'online'), 0)::int AS online_paise,
           COALESCE(SUM(total_paise) FILTER (WHERE status <> 'cancelled' AND payment_status <> 'awaiting' AND channel = 'whatsapp'), 0)::int AS whatsapp_paise,
           COALESCE(SUM(total_paise) FILTER (WHERE status <> 'cancelled' AND payment_status <> 'awaiting' AND channel = 'store'), 0)::int AS store_paise,
           COALESCE(SUM(shipping_paise) FILTER (WHERE status <> 'cancelled' AND payment_status <> 'awaiting'), 0)::int AS shipping_paise
         FROM orders
         WHERE created_at::date BETWEEN $1::date AND $2::date`,
        [from, to],
      );
      const top = await pool.query(
        `SELECT i.product_name, SUM(i.quantity)::int AS quantity, SUM(i.unit_price_paise * i.quantity)::int AS paise
         FROM order_items i
         JOIN orders o ON o.id = i.order_id
         WHERE o.status <> 'cancelled' AND payment_status <> 'awaiting' AND o.created_at::date BETWEEN $1::date AND $2::date
         GROUP BY i.product_name
         ORDER BY paise DESC
         LIMIT 8`,
        [from, to],
      );
      const daily = await pool.query(
        `SELECT created_at::date AS day,
           COUNT(*) FILTER (WHERE status <> 'cancelled' AND payment_status <> 'awaiting')::int AS orders,
           COALESCE(SUM(total_paise) FILTER (WHERE status <> 'cancelled' AND payment_status <> 'awaiting'), 0)::int AS paise
         FROM orders
         WHERE created_at::date BETWEEN $1::date AND $2::date
         GROUP BY 1
         ORDER BY 1`,
        [from, to],
      );
      const sales = await pool.query(
        `SELECT order_number, customer_name, phone, state, channel, status, payment_status, payment_method,
                total_paise, shipping_paise, created_at
         FROM orders
         WHERE created_at::date BETWEEN $1::date AND $2::date
         ORDER BY created_at DESC
         LIMIT 500`,
        [from, to],
      );
      const byState = await pool.query(
        `SELECT COALESCE(NULLIF(state, ''), 'Unknown') AS state,
           COUNT(*) FILTER (WHERE status <> 'cancelled' AND payment_status <> 'awaiting')::int AS orders,
           COALESCE(SUM(total_paise) FILTER (WHERE status <> 'cancelled' AND payment_status <> 'awaiting'), 0)::int AS paise,
           COALESCE(SUM(shipping_paise) FILTER (WHERE status <> 'cancelled' AND payment_status <> 'awaiting'), 0)::int AS shipping_paise
         FROM orders
         WHERE created_at::date BETWEEN $1::date AND $2::date
         GROUP BY 1
         ORDER BY paise DESC`,
        [from, to],
      );
      const byStatus = await pool.query(
        `SELECT status, COUNT(*)::int AS orders,
           COALESCE(SUM(total_paise), 0)::int AS paise
         FROM orders
         WHERE created_at::date BETWEEN $1::date AND $2::date
         GROUP BY status`,
        [from, to],
      );
      const low = await pool.query(
        `SELECT p.name, v.label, v.stock_qty
         FROM variants v
         JOIN products p ON p.id = v.product_id
         WHERE v.stock_qty <= 8
         ORDER BY v.stock_qty, p.name, v.weight_grams
         LIMIT 12`,
      );
      const row = totals.rows[0];
      res.json({
        from,
        to,
        onlineOrders: row.online_orders,
        whatsappOrders: row.whatsapp_orders,
        storeBills: row.store_bills,
        cancelled: row.cancelled,
        onlinePaise: row.online_paise,
        whatsappPaise: row.whatsapp_paise,
        storePaise: row.store_paise,
        shippingPaise: row.shipping_paise,
        paidOrders: row.paid_orders,
        awaitingOrders: row.awaiting_orders,
        byState: byState.rows.map((item) => ({
          state: item.state,
          orders: item.orders,
          paise: item.paise,
          shippingPaise: item.shipping_paise,
        })),
        byStatus: byStatus.rows.map((item) => ({
          status: item.status,
          orders: item.orders,
          paise: item.paise,
        })),
        top: top.rows.map((item) => ({
          name: item.product_name,
          quantity: item.quantity,
          paise: item.paise,
        })),
        lowStock: low.rows.map((item) => ({
          name: item.name,
          label: item.label,
          stockQty: item.stock_qty,
        })),
        daily: daily.rows.map((item) => ({
          date: new Date(item.day).toISOString().slice(0, 10),
          orders: item.orders,
          paise: item.paise,
        })),
        sales: sales.rows.map((item) => ({
          orderNumber: item.order_number,
          customerName: item.customer_name,
          phone: item.phone,
          state: item.state || '',
          channel: item.channel,
          status: item.status,
          paymentStatus: item.payment_status || '',
          paymentMethod: item.payment_method || '',
          totalPaise: item.total_paise,
          shippingPaise: item.shipping_paise || 0,
          createdAt: item.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  /* Store billing is paused.
  app.post('/api/admin/pos', requireStaff, allow('admin', 'billing'), async (req, res, next) => {
    const name = clip(req.body?.customerName, 80) || 'Walk-in';
    const phone = cleanPhone(req.body?.phone);
    const payment = req.body?.paymentMethod === 'upi' ? 'upi' : 'cash';
    const notes = clip(req.body?.notes, 500);
    if (name.length < 2) return res.status(400).json({ error: 'Enter the customer name, or leave it as Walk-in.' });
    if (phone && !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Enter a 10-digit mobile number, or leave it blank.' });

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const lines = await pricedLines(client, req.body?.items, 50);
      const totalPaise = lines.reduce((sum, line) => sum + line.unitPricePaise * line.quantity, 0);
      const tempNumber = `TMP${Date.now()}${Math.floor(Math.random() * 10000)}`;
      const inserted = await client.query(
        `INSERT INTO orders (
           order_number, customer_name, phone, email, address_line, city, pincode, notes,
           payment_method, status, total_paise, channel
         ) VALUES ($1, $2, $3, '', $4, 'Chennai', '600100', $5, $6, 'delivered', $7, 'store')
         RETURNING id`,
        [tempNumber, name, phone, 'Jagatha Organics counter, Pallikaranai', notes, payment, totalPaise],
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
      await reserveLines(client, lines, { orderId: id, reason: 'pos', staffEmail: req.staff.email });
      await client.query('COMMIT');
      res.status(201).json(await orderWithItems(orderNumber));
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { // ignore
      }
      if (error.status === 400) return res.status(400).json({ error: error.message });
      next(error);
    } finally {
      client.release();
    }
  });
  */

  app.post('/api/admin/videos', requireStaff, allow('admin'), videoUpload.single('video'), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Choose an MP4 video.' });
      const title = clip(req.body?.title, 80) || 'Kitchen clip';
      const src = `/videos/${req.file.filename}`;
      const inserted = await getPool().query(
        `INSERT INTO videos (title, src, sort_order)
         VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM videos))
         RETURNING id, title, src`,
        [title, src],
      );
      res.status(201).json(inserted.rows[0]);
    } catch (error) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      next(error);
    }
  });

  app.delete('/api/admin/videos/:id', requireStaff, allow('admin'), async (req, res, next) => {
    try {
      const found = await getPool().query('DELETE FROM videos WHERE id = $1 RETURNING src', [Number(req.params.id)]);
      if (!found.rows[0]) return res.status(404).json({ error: 'Video not found.' });
      const src = found.rows[0].src || '';
      if (src.startsWith('/videos/')) {
        const file = path.resolve(videoRoot, path.basename(src));
        if (file.startsWith(path.resolve(videoRoot)) && fs.existsSync(file)) fs.unlinkSync(file);
      }
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/banners', requireStaff, allow('admin'), async (_req, res, next) => {
    try {
      const { rows } = await getPool().query('SELECT * FROM banners ORDER BY sort_order, id');
      res.json(rows.map(mapBanner));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/banners', requireStaff, allow('admin'), bannerUpload.single('image'), async (req, res, next) => {
    try {
      const product = await bannerProduct(req.body);
      const image = req.file ? `/banner-images/${req.file.filename}` : product.image;
      if (!image) return res.status(400).json({ error: 'Choose a combo or a banner image.' });
      const inserted = await getPool().query(
        `INSERT INTO banners (title, subtitle, button_label, link_url, image_url, active, product_slug, variant_label, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM banners))
         RETURNING *`,
        [
          clip(req.body?.title, 90),
          clip(req.body?.subtitle, 200),
          clip(req.body?.buttonLabel, 40),
          product.slug ? '' : bannerLink(req.body?.link),
          image,
          req.body?.active !== 'false',
          product.slug,
          product.label,
        ],
      );
      res.status(201).json(mapBanner(inserted.rows[0]));
    } catch (error) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      next(error);
    }
  });

  app.patch('/api/admin/banners/:id', requireStaff, allow('admin'), bannerUpload.single('image'), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const current = await getPool().query('SELECT image_url FROM banners WHERE id = $1', [id]);
      if (!current.rows[0]) {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Banner not found.' });
      }
      const image = req.file ? `/banner-images/${req.file.filename}` : current.rows[0].image_url;
      const product = await bannerProduct(req.body);
      const updated = await getPool().query(
        `UPDATE banners
         SET title = $2, subtitle = $3, button_label = $4, link_url = $5, image_url = $6, active = $7,
             product_slug = $8, variant_label = $9
         WHERE id = $1
         RETURNING *`,
        [
          id,
          clip(req.body?.title, 90),
          clip(req.body?.subtitle, 200),
          clip(req.body?.buttonLabel, 40),
          product.slug ? '' : bannerLink(req.body?.link),
          image,
          req.body?.active !== 'false',
          product.slug,
          product.label,
        ],
      );
      if (req.file) removeBannerFile(current.rows[0].image_url);
      res.json(mapBanner(updated.rows[0]));
    } catch (error) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      next(error);
    }
  });

  app.put('/api/admin/banners/order', requireStaff, allow('admin'), async (req, res, next) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
    if (!ids.length) return res.status(400).json({ error: 'Send the banner order.' });
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      for (const [index, id] of ids.entries()) {
        await client.query('UPDATE banners SET sort_order = $2 WHERE id = $1', [id, index + 1]);
      }
      await client.query('COMMIT');
      const { rows } = await client.query('SELECT * FROM banners ORDER BY sort_order, id');
      res.json(rows.map(mapBanner));
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      next(error);
    } finally {
      client.release();
    }
  });

  app.delete('/api/admin/banners/:id', requireStaff, allow('admin'), async (req, res, next) => {
    try {
      const found = await getPool().query('DELETE FROM banners WHERE id = $1 RETURNING image_url', [Number(req.params.id)]);
      if (!found.rows[0]) return res.status(404).json({ error: 'Banner not found.' });
      removeBannerFile(found.rows[0].image_url);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/staff', requireStaff, allow('admin'), async (_req, res, next) => {
    try {
      const { rows } = await getPool().query(
        `SELECT name, email, role, created_at FROM admins ORDER BY created_at`,
      );
      res.json(rows.map((row) => ({
        name: row.name,
        email: row.email,
        role: row.role,
        createdAt: row.created_at,
      })));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/staff', requireStaff, allow('admin'), async (req, res, next) => {
    try {
      const name = clip(req.body?.name, 80);
      const email = clip(req.body?.email, 120).toLowerCase();
      const password = String(req.body?.password || '');
      const role = String(req.body?.role || '');
      if (name.length < 2) return res.status(400).json({ error: 'Enter the staff name.' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' });
      if (password.length < 8) return res.status(400).json({ error: 'Use a password of at least 8 characters.' });
      if (!['admin', 'billing', 'delivery'].includes(role)) return res.status(400).json({ error: 'Choose a role.' });
      await getPool().query(
        `INSERT INTO admins (email, password_hash, name, role) VALUES ($1, $2, $3, $4)`,
        [email, bcrypt.hashSync(password, 10), name, role],
      );
      res.status(201).json({ name, email, role });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'That email is already on the desk.' });
      next(error);
    }
  });

  app.patch('/api/admin/orders/:orderNumber', requireStaff, async (req, res, next) => {
    const client = await getPool().connect();
    try {
      const role = req.staff.role;
      const orderNumber = String(req.params.orderNumber).toUpperCase();
      let status = req.body?.status ? String(req.body.status) : '';
      if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown order status.' });

      await client.query('BEGIN');
      const existing = await client.query('SELECT id, status FROM orders WHERE order_number = $1 FOR UPDATE', [orderNumber]);
      if (!existing.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Order not found.' });
      }
      const orderId = existing.rows[0].id;
      const previous = existing.rows[0].status;
      if (role === 'delivery' && previous === 'cancelled') {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Delivery staff cannot reopen a cancelled order.' });
      }
      if (role === 'delivery' && status && status !== previous && !['packed', 'shipped', 'delivered'].includes(status)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Delivery staff can mark an order packed, shipped, or delivered.' });
      }
      if (status && status !== previous) {
        const restockable = ['pending', 'confirmed', 'packed'];
        if (status === 'cancelled' && previous !== 'cancelled' && restockable.includes(previous)) {
          await restoreLines(client, orderId, req.staff.email);
        }
        if (previous === 'cancelled' && status !== 'cancelled') {
          const returned = await client.query(
            `SELECT 1 FROM inventory_moves WHERE order_id = $1 AND reason = 'cancel_return' LIMIT 1`,
            [orderId],
          );
          if (returned.rows[0]) {
            const items = await client.query(
              `SELECT variant_id, quantity FROM order_items WHERE order_id = $1 AND variant_id IS NOT NULL`,
              [orderId],
            );
            await reserveLines(
              client,
              items.rows.map((row) => ({ variantId: row.variant_id, quantity: row.quantity })),
              { orderId, reason: 'sale', staffEmail: req.staff.email },
            );
          }
        }
      }

      const note = role === 'delivery' || req.body?.adminNote == null ? null : clip(req.body.adminNote, 500);
      const canCourier = role === 'admin' || role === 'delivery';
      const courierName = canCourier && req.body?.courierName != null ? clip(req.body.courierName, 80) : null;
      const trackingNumber = canCourier && req.body?.trackingNumber != null ? clip(req.body.trackingNumber, 80) : null;
      const trackingUrl = canCourier && req.body?.trackingUrl != null ? httpUrl(req.body.trackingUrl) : null;

      await client.query(
        `UPDATE orders
         SET status = COALESCE($2, status),
             admin_note = COALESCE($3, admin_note),
             courier_name = COALESCE($4, courier_name),
             tracking_number = COALESCE($5, tracking_number),
             tracking_url = COALESCE($6, tracking_url),
             updated_at = NOW()
         WHERE id = $1`,
        [orderId, status || null, note, courierName, trackingNumber, trackingUrl],
      );
      if (status && status !== previous) {
        const shipNote = status === 'shipped' && (courierName || trackingNumber)
          ? [courierName, trackingNumber].filter(Boolean).join(' · ')
          : '';
        await addEvent(client, orderId, status, shipNote);
      }
      await client.query('COMMIT');
      res.json(await orderWithItems(orderNumber));
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      if (error.status === 400) return res.status(400).json({ error: error.message });
      next(error);
    } finally {
      client.release();
    }
  });
}
