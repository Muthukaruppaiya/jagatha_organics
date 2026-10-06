import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const databaseDir = path.resolve(__dirname, '../data/pg');

let embedded;
let pool;

export async function startDatabase() {
  const user = process.env.PG_USER || 'jagatha';
  const password = process.env.PG_PASSWORD || 'jagatha_local';
  const port = Number(process.env.PG_PORT || 54329);

  embedded = new EmbeddedPostgres({
    databaseDir,
    user,
    password,
    port,
    persistent: true,
    authMethod: 'password',
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  try {
    await embedded.initialise();
  } catch (error) {
    const message = String(error?.message || error);
    if (!/already|exists|not empty/i.test(message)) throw error;
  }

  try {
    await embedded.start();
  } catch (error) {
    const message = String(error?.message || error);
    if (!/already running|EADDRINUSE/i.test(message)) throw error;
  }

  try {
    await embedded.createDatabase('jagatha_organics');
  } catch (error) {
    const message = String(error?.message || error);
    if (!/already exists/i.test(message)) throw error;
  }

  pool = new pg.Pool({
    host: '127.0.0.1',
    port,
    user,
    password,
    database: 'jagatha_organics',
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      blurb TEXT NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      category_id INT NOT NULL REFERENCES categories(id),
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      image_urls TEXT[] NOT NULL DEFAULT '{}',
      featured BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS variants (
      id SERIAL PRIMARY KEY,
      product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      weight_grams INT NOT NULL,
      price_paise INT NOT NULL,
      compare_paise INT NOT NULL,
      UNIQUE (product_id, label)
    );

    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      address_line TEXT NOT NULL,
      city TEXT NOT NULL,
      pincode TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      admin_note TEXT NOT NULL DEFAULT '',
      payment_method TEXT NOT NULL DEFAULT 'cod',
      status TEXT NOT NULL DEFAULT 'pending',
      total_paise INT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      product_slug TEXT NOT NULL,
      variant_label TEXT NOT NULL,
      unit_price_paise INT NOT NULL,
      quantity INT NOT NULL,
      image_url TEXT NOT NULL DEFAULT ''
    );
  `);

  await pool.query(`
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'online';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT NOT NULL DEFAULT '';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT NOT NULL DEFAULT '';
    ALTER TABLE variants ADD COLUMN IF NOT EXISTS stock_qty INT NOT NULL DEFAULT 24;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id INT;

    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id INT REFERENCES customers(id);

    CREATE TABLE IF NOT EXISTS favorites (
      customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      product_slug TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (customer_id, product_slug)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      product_slug TEXT NOT NULL,
      product_name TEXT NOT NULL,
      rating INT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (customer_id, product_slug)
    );

    CREATE TABLE IF NOT EXISTS videos (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      src TEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS inventory_moves (
      id SERIAL PRIMARY KEY,
      variant_id INT NOT NULL REFERENCES variants(id),
      order_id INT REFERENCES orders(id) ON DELETE SET NULL,
      quantity_delta INT NOT NULL,
      reason TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      staff_email TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  return pool;
}

export function getPool() {
  return pool;
}

export async function stopDatabase() {
  if (pool) await pool.end();
  if (embedded) {
    try {
      await embedded.stop();
    } catch {
      /* already stopped */
    }
  }
}
