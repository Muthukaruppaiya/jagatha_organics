import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { banners, CATALOG_VERSION, categories, products } from './catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imageRoot = path.resolve(__dirname, '../../reference/product-images');

function collectImages() {
  const map = new Map();
  if (!fs.existsSync(imageRoot)) return map;
  for (const folder of fs.readdirSync(imageRoot)) {
    if (folder === 'uploads') continue;
    const dir = path.join(imageRoot, folder);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      const match = file.match(/^(.*)-(\d+)\.(png|jpe?g|webp)$/i);
      if (!match) continue;
      const slug = match[1];
      const list = map.get(slug) || [];
      list.push({ n: Number(match[2]), url: `/media/${folder}/${file}` });
      map.set(slug, list);
    }
  }
  for (const [slug, list] of map) {
    list.sort((a, b) => a.n - b.n);
    map.set(slug, list.map((item) => item.url));
  }
  return map;
}

async function dropVariants(client, variantIds) {
  if (!variantIds.length) return;
  await client.query('DELETE FROM inventory_moves WHERE variant_id = ANY($1::int[])', [variantIds]);
  await client.query('DELETE FROM variants WHERE id = ANY($1::int[])', [variantIds]);
}

async function installCatalog(client) {
  const images = collectImages();

  for (const category of categories) {
    await client.query(
      `INSERT INTO categories (slug, name, blurb, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name, blurb = EXCLUDED.blurb, sort_order = EXCLUDED.sort_order`,
      [category.slug, category.name, category.blurb, category.sortOrder],
    );
  }
  const { rows: categoryRows } = await client.query('SELECT id, slug FROM categories');
  const categoryId = new Map(categoryRows.map((row) => [row.slug, row.id]));

  for (const [index, product] of products.entries()) {
    const inserted = await client.query(
      `INSERT INTO products (category_id, slug, name, description, image_urls, featured, active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
       ON CONFLICT (slug) DO UPDATE
       SET category_id = EXCLUDED.category_id,
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           image_urls = EXCLUDED.image_urls,
           featured = EXCLUDED.featured,
           active = TRUE,
           sort_order = EXCLUDED.sort_order
       RETURNING id`,
      [categoryId.get(product.category), product.slug, product.name, product.description, images.get(product.slug) || [], product.featured, index + 1],
    );
    const productId = inserted.rows[0].id;
    for (const variant of product.variants) {
      await client.query(
        `INSERT INTO variants (product_id, label, weight_grams, price_paise, compare_paise)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (product_id, label) DO UPDATE
         SET weight_grams = EXCLUDED.weight_grams,
             price_paise = EXCLUDED.price_paise,
             compare_paise = EXCLUDED.compare_paise`,
        [productId, variant.label, variant.grams, variant.price, variant.compare],
      );
    }
    const stale = await client.query(
      'SELECT id FROM variants WHERE product_id = $1 AND NOT (label = ANY($2::text[]))',
      [productId, product.variants.map((variant) => variant.label)],
    );
    await dropVariants(client, stale.rows.map((row) => row.id));
  }

  const keep = products.map((product) => product.slug);
  const old = await client.query('SELECT id, slug FROM products WHERE NOT (slug = ANY($1::text[]))', [keep]);
  if (old.rows.length) {
    const ids = old.rows.map((row) => row.id);
    const variants = await client.query('SELECT id FROM variants WHERE product_id = ANY($1::int[])', [ids]);
    await dropVariants(client, variants.rows.map((row) => row.id));
    await client.query('DELETE FROM favorites WHERE product_slug = ANY($1::text[])', [old.rows.map((row) => row.slug)]);
    await client.query('DELETE FROM products WHERE id = ANY($1::int[])', [ids]);
  }
  await client.query(
    'DELETE FROM categories WHERE NOT (slug = ANY($1::text[])) AND id NOT IN (SELECT category_id FROM products)',
    [categories.map((category) => category.slug)],
  );

  await client.query('DELETE FROM banners');
  for (const [index, banner] of banners.entries()) {
    await client.query(
      `INSERT INTO banners (title, subtitle, button_label, link_url, image_url, product_slug, variant_label, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [banner.title, banner.subtitle, banner.buttonLabel, banner.link, banner.image, banner.productSlug, banner.variantLabel, index + 1],
    );
  }

  await client.query(
    `INSERT INTO settings (key, value) VALUES ('catalog_version', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [CATALOG_VERSION],
  );
  console.log(`Installed the product list: ${products.length} products, ${old.rows.length} old products removed.`);
}

export async function seedDatabase(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const version = await client.query(`SELECT value FROM settings WHERE key = 'catalog_version'`);
    if (version.rows[0]?.value !== CATALOG_VERSION) await installCatalog(client);

    const email = (process.env.ADMIN_EMAIL || 'admin@jagathaorganics.com').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'Jagatha@2026';
    const hash = bcrypt.hashSync(password, 10);
    await client.query(
      `INSERT INTO admins (email, password_hash, name, role)
       VALUES ($1, $2, 'Jagatha Admin', 'admin')
       ON CONFLICT (email) DO UPDATE SET role = 'admin'`,
      [email, hash],
    );
    const desks = [
      ['billing@jagathaorganics.com', 'Billing@2026', 'Billing staff', 'billing'],
      ['delivery@jagathaorganics.com', 'Delivery@2026', 'Delivery staff', 'delivery'],
    ];
    for (const [deskEmail, deskPassword, deskName, role] of desks) {
      await client.query(
        `INSERT INTO admins (email, password_hash, name, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        [deskEmail, bcrypt.hashSync(deskPassword, 10), deskName, role],
      );
    }

    const videoCount = await client.query('SELECT COUNT(*)::int AS n FROM videos');
    if (videoCount.rows[0].n === 0) {
      const clips = [
        ['No sugar, no jaggery protein bars', '/reels/reel-2.mp4', 1],
        ['No sugar, no jaggery', '/reels/reel-4.mp4', 2],
        ['Happy New Year 2026', '/reels/reel-3.mp4', 3],
        ['Back to a happy family', '/reels/reel-1.mp4', 4],
      ];
      for (const [title, src, sortOrder] of clips) {
        await client.query(
          'INSERT INTO videos (title, src, sort_order) VALUES ($1, $2, $3)',
          [title, src, sortOrder],
        );
      }
    }

    await client.query('COMMIT');
    const count = await client.query('SELECT COUNT(*)::int AS n FROM products WHERE active');
    console.log(`Catalog ready. ${count.rows[0].n} products in the shop.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
