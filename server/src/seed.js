import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { categories, products } from './catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imageRoot = path.resolve(__dirname, '../../reference/product-images');

function collectImages() {
  const map = new Map();
  if (!fs.existsSync(imageRoot)) return map;
  for (const folder of fs.readdirSync(imageRoot)) {
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

export async function seedDatabase(pool) {
  const images = collectImages();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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

    for (const product of products) {
      const scanned = images.get(product.slug) || [];
      const current = await client.query('SELECT image_urls FROM products WHERE slug = $1', [product.slug]);
      const root = path.resolve(imageRoot);
      const kept = (current.rows[0]?.image_urls || []).filter((url) => {
        if (scanned.includes(url) || !String(url).startsWith('/media/')) return false;
        const relative = decodeURIComponent(String(url).slice('/media/'.length));
        const file = path.resolve(imageRoot, relative);
        const rootKey = `${root.toLowerCase()}${path.sep}`;
        return file.toLowerCase().startsWith(rootKey) && fs.existsSync(file);
      });
      const urls = [...scanned, ...kept];
      if (urls.length === 0) {
        console.warn(`No images for ${product.slug}`);
      }
      const inserted = await client.query(
        `INSERT INTO products (category_id, slug, name, description, image_urls, featured)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (slug) DO UPDATE
         SET category_id = EXCLUDED.category_id,
             name = EXCLUDED.name,
             description = EXCLUDED.description,
             image_urls = EXCLUDED.image_urls,
             featured = EXCLUDED.featured
         RETURNING id`,
        [categoryId.get(product.category), product.slug, product.name, product.description, urls, product.featured],
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
    }

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
    console.log(`Catalog ready. ${products.length} products.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
