import { getPool } from './db.js';

function text(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function fail(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';
}

async function uniqueSlug(client, table, base) {
  let slug = base;
  for (let n = 2; ; n += 1) {
    const taken = await client.query(`SELECT 1 FROM ${table} WHERE slug = $1`, [slug]);
    if (!taken.rows[0]) return slug;
    slug = `${base}-${n}`;
  }
}

function readVariants(input) {
  if (!Array.isArray(input) || input.length === 0) throw fail('Add at least one pack size.');
  if (input.length > 8) throw fail('Use eight pack sizes or fewer.');
  const seen = new Set();
  return input.map((item) => {
    const label = text(item.label, 20);
    const grams = Number(item.grams);
    const pricePaise = Number(item.pricePaise);
    const comparePaise = Number(item.comparePaise || 0);
    if (!label) throw fail('Every pack needs a name, such as 200g.');
    if (seen.has(label.toLowerCase())) throw fail(`The pack ${label} is listed twice.`);
    seen.add(label.toLowerCase());
    if (!Number.isInteger(grams) || grams < 1 || grams > 100000) throw fail(`Enter the weight in grams for ${label}.`);
    if (!Number.isInteger(pricePaise) || pricePaise < 100 || pricePaise > 100000000) throw fail(`Enter a price for ${label}.`);
    if (!Number.isInteger(comparePaise) || comparePaise < 0) throw fail(`Enter a valid MRP for ${label}, or leave it blank.`);
    const id = Number(item.id);
    return {
      id: Number.isInteger(id) && id > 0 ? id : null,
      label,
      grams,
      pricePaise,
      comparePaise: Math.max(comparePaise, pricePaise),
    };
  });
}

async function readProduct(client, body) {
  const name = text(body?.name, 120);
  if (name.length < 2) throw fail('Enter the product name.');
  const category = await client.query('SELECT id FROM categories WHERE slug = $1', [text(body?.categorySlug, 80)]);
  if (!category.rows[0]) throw fail('Choose a category.');
  return {
    name,
    categoryId: category.rows[0].id,
    description: text(body?.description, 1000),
    featured: Boolean(body?.featured),
    active: body?.active !== false,
    variants: readVariants(body?.variants),
  };
}

async function saveVariants(client, productId, variants) {
  const current = await client.query('SELECT id FROM variants WHERE product_id = $1', [productId]);
  const currentIds = current.rows.map((row) => row.id);
  const keptIds = variants.map((variant) => variant.id).filter((id) => currentIds.includes(id));
  const dropped = currentIds.filter((id) => !keptIds.includes(id));
  if (dropped.length) {
    await client.query('DELETE FROM inventory_moves WHERE variant_id = ANY($1::int[])', [dropped]);
    await client.query('DELETE FROM variants WHERE id = ANY($1::int[])', [dropped]);
  }
  for (const variant of variants) {
    if (variant.id && currentIds.includes(variant.id)) {
      await client.query(
        `UPDATE variants SET label = $2, weight_grams = $3, price_paise = $4, compare_paise = $5 WHERE id = $1`,
        [variant.id, variant.label, variant.grams, variant.pricePaise, variant.comparePaise],
      );
    } else {
      await client.query(
        `INSERT INTO variants (product_id, label, weight_grams, price_paise, compare_paise)
         VALUES ($1, $2, $3, $4, $5)`,
        [productId, variant.label, variant.grams, variant.pricePaise, variant.comparePaise],
      );
    }
  }
}

const productQuery = `
  SELECT p.slug, p.name, p.description, p.featured, p.active, p.sort_order, p.image_urls,
         c.slug AS category_slug, c.name AS category_name,
         COALESCE((
           SELECT json_agg(json_build_object(
             'id', v.id, 'label', v.label, 'grams', v.weight_grams,
             'pricePaise', v.price_paise, 'comparePaise', v.compare_paise, 'stockQty', v.stock_qty
           ) ORDER BY v.weight_grams)
           FROM variants v WHERE v.product_id = p.id
         ), '[]'::json) AS variants
  FROM products p
  JOIN categories c ON c.id = p.category_id`;

function mapDeskProduct(row) {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    featured: row.featured,
    active: row.active,
    sortOrder: row.sort_order,
    images: row.image_urls || [],
    category: { slug: row.category_slug, name: row.category_name },
    variants: row.variants,
  };
}

async function deskProduct(client, slug) {
  const { rows } = await client.query(`${productQuery} WHERE p.slug = $1`, [slug]);
  return rows[0] ? mapDeskProduct(rows[0]) : null;
}

export function registerProductDesk(app, { requireStaff, allow }) {
  const owner = [requireStaff, allow('admin')];

  async function inTransaction(res, next, work) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      if (error.status === 400 || error.status === 404) {
        res.status(error.status).json({ error: error.message });
        return undefined;
      }
      next(error);
      return undefined;
    } finally {
      client.release();
    }
  }

  app.get('/api/admin/products', ...owner, async (_req, res, next) => {
    try {
      const { rows } = await getPool().query(`${productQuery} ORDER BY c.sort_order, c.id, p.sort_order, p.name`);
      res.json(rows.map(mapDeskProduct));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/products', ...owner, async (req, res, next) => {
    const saved = await inTransaction(res, next, async (client) => {
      const product = await readProduct(client, req.body);
      const slug = await uniqueSlug(client, 'products', slugify(req.body?.slug || product.name));
      const inserted = await client.query(
        `INSERT INTO products (category_id, slug, name, description, image_urls, featured, active, sort_order)
         VALUES ($1, $2, $3, $4, '{}', $5, $6, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM products WHERE category_id = $1))
         RETURNING id`,
        [product.categoryId, slug, product.name, product.description, product.featured, product.active],
      );
      await saveVariants(client, inserted.rows[0].id, product.variants);
      return deskProduct(client, slug);
    });
    if (saved) res.status(201).json(saved);
  });

  app.patch('/api/admin/products/:slug', ...owner, async (req, res, next) => {
    const saved = await inTransaction(res, next, async (client) => {
      const found = await client.query('SELECT id FROM products WHERE slug = $1', [req.params.slug]);
      if (!found.rows[0]) {
        const error = new Error('Product not found.');
        error.status = 404;
        throw error;
      }
      const product = await readProduct(client, req.body);
      await client.query(
        `UPDATE products SET name = $2, category_id = $3, description = $4, featured = $5, active = $6 WHERE id = $1`,
        [found.rows[0].id, product.name, product.categoryId, product.description, product.featured, product.active],
      );
      await saveVariants(client, found.rows[0].id, product.variants);
      return deskProduct(client, req.params.slug);
    });
    if (saved) res.json(saved);
  });

  app.delete('/api/admin/products/:slug', ...owner, async (req, res, next) => {
    const done = await inTransaction(res, next, async (client) => {
      const found = await client.query('SELECT id FROM products WHERE slug = $1', [req.params.slug]);
      if (!found.rows[0]) {
        const error = new Error('Product not found.');
        error.status = 404;
        throw error;
      }
      const productId = found.rows[0].id;
      await client.query(
        'DELETE FROM inventory_moves WHERE variant_id IN (SELECT id FROM variants WHERE product_id = $1)',
        [productId],
      );
      await client.query('DELETE FROM favorites WHERE product_slug = $1', [req.params.slug]);
      await client.query(`UPDATE banners SET product_slug = '', variant_label = '' WHERE product_slug = $1`, [req.params.slug]);
      await client.query('DELETE FROM products WHERE id = $1', [productId]);
      return { ok: true };
    });
    if (done) res.json(done);
  });

  app.get('/api/admin/categories', ...owner, async (_req, res, next) => {
    try {
      const { rows } = await getPool().query(
        `SELECT c.slug, c.name, c.blurb, c.sort_order, COUNT(p.id)::int AS count
         FROM categories c
         LEFT JOIN products p ON p.category_id = c.id
         GROUP BY c.id
         ORDER BY c.sort_order, c.id`,
      );
      res.json(rows.map((row) => ({ slug: row.slug, name: row.name, blurb: row.blurb, sortOrder: row.sort_order, count: row.count })));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/categories', ...owner, async (req, res, next) => {
    const saved = await inTransaction(res, next, async (client) => {
      const name = text(req.body?.name, 60);
      if (name.length < 2) throw fail('Enter the category name.');
      const slug = await uniqueSlug(client, 'categories', slugify(name));
      const { rows } = await client.query(
        `INSERT INTO categories (slug, name, blurb, sort_order)
         VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories))
         RETURNING slug, name, blurb, sort_order`,
        [slug, name, text(req.body?.blurb, 200)],
      );
      return { slug: rows[0].slug, name: rows[0].name, blurb: rows[0].blurb, sortOrder: rows[0].sort_order, count: 0 };
    });
    if (saved) res.status(201).json(saved);
  });

  app.patch('/api/admin/categories/:slug', ...owner, async (req, res, next) => {
    const saved = await inTransaction(res, next, async (client) => {
      const name = text(req.body?.name, 60);
      if (name.length < 2) throw fail('Enter the category name.');
      const { rows } = await client.query(
        'UPDATE categories SET name = $2, blurb = $3 WHERE slug = $1 RETURNING slug, name, blurb, sort_order',
        [req.params.slug, name, text(req.body?.blurb, 200)],
      );
      if (!rows[0]) throw fail('Category not found.');
      return { slug: rows[0].slug, name: rows[0].name, blurb: rows[0].blurb, sortOrder: rows[0].sort_order };
    });
    if (saved) res.json(saved);
  });

  app.delete('/api/admin/categories/:slug', ...owner, async (req, res, next) => {
    const done = await inTransaction(res, next, async (client) => {
      const used = await client.query(
        'SELECT COUNT(p.id)::int AS n FROM categories c LEFT JOIN products p ON p.category_id = c.id WHERE c.slug = $1',
        [req.params.slug],
      );
      if (used.rows[0]?.n > 0) throw fail('Move or delete the products in this category first.');
      await client.query('DELETE FROM categories WHERE slug = $1', [req.params.slug]);
      return { ok: true };
    });
    if (done) res.json(done);
  });
}
