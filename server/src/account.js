import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool } from './db.js';
import { cleanPhone, mapAddress, readAddress } from './address.js';
import { sendMail } from './mailer.js';

const OTP_MINUTES = 10;
const OTP_ATTEMPTS = 5;
const OTP_RESEND_SECONDS = 30;

function otpHash(email, code) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${email}:${code}`).digest('hex');
}

function clip(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

export function customerFrom(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.kind !== 'customer') return null;
    return payload;
  } catch {
    return null;
  }
}

function requireCustomer(req, res, next) {
  const customer = customerFrom(req);
  if (!customer) return res.status(401).json({ error: 'Please sign in to your account.' });
  req.customer = customer;
  next();
}

function signCustomer(row) {
  const customer = { id: row.id, name: row.name, email: row.email, phone: row.phone };
  const token = jwt.sign({ kind: 'customer', ...customer }, process.env.JWT_SECRET, { expiresIn: '30d' });
  return { token, customer };
}

export function registerAccount(app) {
  app.post('/api/account/register/start', async (req, res, next) => {
    try {
      const name = clip(req.body?.name, 80);
      const email = clip(req.body?.email, 120).toLowerCase();
      const phone = cleanPhone(req.body?.phone);
      const password = String(req.body?.password || '');
      if (name.length < 2) return res.status(400).json({ error: 'Enter your name.' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' });
      if (!/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Enter a 10-digit mobile number.' });
      if (password.length < 8) return res.status(400).json({ error: 'Use a password of at least 8 characters.' });

      const taken = await getPool().query('SELECT 1 FROM customers WHERE email = $1', [email]);
      if (taken.rows[0]) return res.status(409).json({ error: 'An account already uses that email. Sign in instead.' });
      const recent = await getPool().query(
        `SELECT 1 FROM otp_codes WHERE email = $1 AND sent_at > NOW() - make_interval(secs => $2)`,
        [email, OTP_RESEND_SECONDS],
      );
      if (recent.rows[0]) return res.status(429).json({ error: `Please wait ${OTP_RESEND_SECONDS} seconds before asking for a new code.` });

      const code = String(crypto.randomInt(100000, 1000000));
      await getPool().query(
        `INSERT INTO otp_codes (email, code_hash, payload, attempts, expires_at, sent_at)
         VALUES ($1, $2, $3, 0, NOW() + make_interval(mins => $4), NOW())
         ON CONFLICT (email) DO UPDATE
         SET code_hash = EXCLUDED.code_hash, payload = EXCLUDED.payload, attempts = 0,
             expires_at = EXCLUDED.expires_at, sent_at = NOW()`,
        [email, otpHash(email, code), { name, phone, passwordHash: bcrypt.hashSync(password, 10) }, OTP_MINUTES],
      );
      const mail = await sendMail({
        to: email,
        subject: `${code} is your Jagatha Organics code`,
        text: `Hello ${name},\n\nYour Jagatha Organics verification code is ${code}. It works for ${OTP_MINUTES} minutes.\n\nIf you did not ask for it, ignore this email.`,
        html: `<p>Hello ${name.replace(/[<>&]/g, '')},</p><p>Your Jagatha Organics verification code is</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It works for ${OTP_MINUTES} minutes. If you did not ask for it, ignore this email.</p>`,
      });
      res.json({ sent: true, email, delivered: mail.delivered });
    } catch (error) {
      if (error.status === 503) return res.status(503).json({ error: error.message });
      next(error);
    }
  });

  app.post('/api/account/register/verify', async (req, res, next) => {
    const client = await getPool().connect();
    try {
      const email = clip(req.body?.email, 120).toLowerCase();
      const code = String(req.body?.code || '').replace(/\D/g, '');
      await client.query('BEGIN');
      const { rows } = await client.query('SELECT * FROM otp_codes WHERE email = $1 FOR UPDATE', [email]);
      const row = rows[0];
      if (!row || new Date(row.expires_at) < new Date()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'That code has expired. Ask for a new one.' });
      }
      if (row.attempts >= OTP_ATTEMPTS) {
        await client.query('ROLLBACK');
        return res.status(429).json({ error: 'Too many tries. Ask for a new code.' });
      }
      const expected = Buffer.from(row.code_hash);
      const given = Buffer.from(otpHash(email, code));
      if (code.length !== 6 || !crypto.timingSafeEqual(expected, given)) {
        await client.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE email = $1', [email]);
        await client.query('COMMIT');
        return res.status(400).json({ error: 'That code is not right. Check the email and try again.' });
      }
      const { name, phone, passwordHash } = row.payload;
      const inserted = await client.query(
        `INSERT INTO customers (name, email, phone, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, email, phone`,
        [name, email, phone, passwordHash],
      );
      await client.query('DELETE FROM otp_codes WHERE email = $1', [email]);
      await client.query('COMMIT');
      res.status(201).json(signCustomer(inserted.rows[0]));
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      if (error.code === '23505') return res.status(409).json({ error: 'An account already uses that email. Sign in instead.' });
      next(error);
    } finally {
      client.release();
    }
  });

  app.get('/api/account/addresses', requireCustomer, async (req, res, next) => {
    try {
      const { rows } = await getPool().query(
        'SELECT * FROM customer_addresses WHERE customer_id = $1 ORDER BY used_at DESC, id DESC',
        [req.customer.id],
      );
      res.json(rows.map(mapAddress));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/account/addresses', requireCustomer, async (req, res, next) => {
    try {
      const a = readAddress(req.body);
      const count = await getPool().query('SELECT COUNT(*)::int AS n FROM customer_addresses WHERE customer_id = $1', [req.customer.id]);
      if (count.rows[0].n >= 10) return res.status(400).json({ error: 'You can keep up to 10 addresses. Remove one first.' });
      const { rows } = await getPool().query(
        `INSERT INTO customer_addresses (customer_id, name, phone, pincode, locality, address_line, city, state, landmark, alt_phone, address_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [req.customer.id, a.name, a.phone, a.pincode, a.locality, a.addressLine, a.city, a.state, a.landmark, a.altPhone, a.addressType],
      );
      res.status(201).json(mapAddress(rows[0]));
    } catch (error) {
      if (error.status === 400) return res.status(400).json({ error: error.message });
      next(error);
    }
  });

  app.patch('/api/account/addresses/:id', requireCustomer, async (req, res, next) => {
    try {
      const a = readAddress(req.body);
      const { rows } = await getPool().query(
        `UPDATE customer_addresses
         SET name = $3, phone = $4, pincode = $5, locality = $6, address_line = $7, city = $8, state = $9,
             landmark = $10, alt_phone = $11, address_type = $12
         WHERE id = $1 AND customer_id = $2 RETURNING *`,
        [Number(req.params.id), req.customer.id, a.name, a.phone, a.pincode, a.locality, a.addressLine, a.city, a.state, a.landmark, a.altPhone, a.addressType],
      );
      if (!rows[0]) return res.status(404).json({ error: 'Address not found.' });
      res.json(mapAddress(rows[0]));
    } catch (error) {
      if (error.status === 400) return res.status(400).json({ error: error.message });
      next(error);
    }
  });

  app.delete('/api/account/addresses/:id', requireCustomer, async (req, res, next) => {
    try {
      await getPool().query('DELETE FROM customer_addresses WHERE id = $1 AND customer_id = $2', [Number(req.params.id), req.customer.id]);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/account/login', async (req, res, next) => {
    try {
      const email = clip(req.body?.email, 120).toLowerCase();
      const password = String(req.body?.password || '');
      const { rows } = await getPool().query('SELECT id, name, email, phone, password_hash FROM customers WHERE email = $1', [email]);
      const row = rows[0];
      if (!row || !bcrypt.compareSync(password, row.password_hash)) {
        return res.status(401).json({ error: 'Those sign-in details do not match.' });
      }
      res.json(signCustomer(row));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/account/orders', requireCustomer, async (req, res, next) => {
    try {
      const { rows } = await getPool().query(
        `SELECT o.order_number, o.status, o.total_paise, o.channel, o.payment_method, o.payment_status, o.created_at,
           o.phone, o.courier_name, o.tracking_number, o.tracking_url,
           COALESCE(
             (
               SELECT json_agg(json_build_object(
                 'productName', i.product_name,
                 'variantLabel', i.variant_label,
                 'quantity', i.quantity,
                 'unitPricePaise', i.unit_price_paise,
                 'imageUrl', i.image_url
               ) ORDER BY i.id)
               FROM order_items i WHERE i.order_id = o.id
             ),
             '[]'::json
           ) AS items
         FROM orders o
         WHERE o.customer_id = $1
            OR (o.email <> '' AND lower(o.email) = $2)
            OR ($3 <> '' AND o.phone = $3)
         ORDER BY o.created_at DESC`,
        [req.customer.id, req.customer.email, req.customer.phone],
      );
      res.json(rows.map((row) => ({
        orderNumber: row.order_number,
        status: row.status,
        totalPaise: row.total_paise,
        channel: row.channel,
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status || '',
        phone: row.phone,
        createdAt: row.created_at,
        courierName: row.courier_name || '',
        trackingNumber: row.tracking_number || '',
        trackingUrl: row.tracking_url || '',
        items: row.items,
      })));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/account/favorites', requireCustomer, async (req, res, next) => {
    try {
      const { rows } = await getPool().query(
        `SELECT p.slug, p.name, p.image_urls[1] AS image, c.name AS category
         FROM favorites f
         JOIN products p ON p.slug = f.product_slug
         JOIN categories c ON c.id = p.category_id
         WHERE f.customer_id = $1
         ORDER BY f.created_at DESC`,
        [req.customer.id],
      );
      res.json(rows.map((row) => ({
        slug: row.slug,
        name: row.name,
        image: row.image || '',
        category: row.category,
      })));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/account/favorites', requireCustomer, async (req, res, next) => {
    try {
      const slug = clip(req.body?.slug, 120);
      const found = await getPool().query('SELECT slug FROM products WHERE slug = $1', [slug]);
      if (!found.rows[0]) return res.status(404).json({ error: 'Product not found.' });
      await getPool().query(
        `INSERT INTO favorites (customer_id, product_slug) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.customer.id, slug],
      );
      res.status(201).json({ slug });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/account/favorites/:slug', requireCustomer, async (req, res, next) => {
    try {
      await getPool().query('DELETE FROM favorites WHERE customer_id = $1 AND product_slug = $2', [req.customer.id, req.params.slug]);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/account/reviews', requireCustomer, async (req, res, next) => {
    try {
      const { rows } = await getPool().query(
        `SELECT id, product_slug, product_name, rating, body, status, created_at
         FROM reviews WHERE customer_id = $1 ORDER BY created_at DESC`,
        [req.customer.id],
      );
      res.json(rows.map(mapReview));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/account/reviews', requireCustomer, async (req, res, next) => {
    try {
      const slug = clip(req.body?.slug, 120);
      const rating = Number(req.body?.rating);
      const body = clip(req.body?.body, 800);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Choose a rating from 1 to 5.' });
      if (body.length < 8) return res.status(400).json({ error: 'Write a few words about the pack.' });
      const product = await getPool().query('SELECT name FROM products WHERE slug = $1', [slug]);
      if (!product.rows[0]) return res.status(404).json({ error: 'Product not found.' });
      const inserted = await getPool().query(
        `INSERT INTO reviews (customer_id, product_slug, product_name, rating, body)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, product_slug, product_name, rating, body, status, created_at`,
        [req.customer.id, slug, product.rows[0].name, rating, body],
      );
      res.status(201).json(mapReview(inserted.rows[0]));
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'You already reviewed this product.' });
      next(error);
    }
  });

  app.get('/api/products/:slug/reviews', async (req, res, next) => {
    try {
      const { rows } = await getPool().query(
        `SELECT r.rating, r.body, r.created_at, c.name
         FROM reviews r
         JOIN customers c ON c.id = r.customer_id
         WHERE r.product_slug = $1 AND r.status = 'approved'
         ORDER BY r.created_at DESC`,
        [req.params.slug],
      );
      const average = rows.length ? rows.reduce((sum, row) => sum + row.rating, 0) / rows.length : 0;
      res.json({
        average: Math.round(average * 10) / 10,
        count: rows.length,
        reviews: rows.map((row) => ({
          name: row.name,
          rating: row.rating,
          body: row.body,
          createdAt: row.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  });
}

function mapReview(row) {
  return {
    id: row.id,
    slug: row.product_slug,
    productName: row.product_name,
    rating: row.rating,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function registerReviewDesk(app, { requireStaff, allow }) {
  app.get('/api/admin/reviews', requireStaff, allow('admin', 'billing'), async (_req, res, next) => {
    try {
      const { rows } = await getPool().query(
        `SELECT r.id, r.product_slug, r.product_name, r.rating, r.body, r.status, r.created_at, c.name
         FROM reviews r
         JOIN customers c ON c.id = r.customer_id
         ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC`,
      );
      res.json(rows.map((row) => ({ ...mapReview(row), customerName: row.name })));
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/admin/reviews/:id', requireStaff, allow('admin', 'billing'), async (req, res, next) => {
    try {
      const status = String(req.body?.status || '');
      if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Choose approve or hide.' });
      const updated = await getPool().query(
        `UPDATE reviews SET status = $2 WHERE id = $1
         RETURNING id, product_slug, product_name, rating, body, status, created_at`,
        [Number(req.params.id), status],
      );
      if (!updated.rows[0]) return res.status(404).json({ error: 'Review not found.' });
      res.json(mapReview(updated.rows[0]));
    } catch (error) {
      next(error);
    }
  });
}
