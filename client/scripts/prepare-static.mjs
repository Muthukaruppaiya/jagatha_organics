import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categories, products } from '../../server/src/catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imageRoot = path.resolve(__dirname, '../../reference/product-images');
const publicDir = path.resolve(__dirname, '../public');
const mediaDir = path.join(publicDir, 'media');

function collectImages() {
  const map = new Map();
  if (!fs.existsSync(imageRoot)) return map;
  for (const folder of fs.readdirSync(imageRoot)) {
    if (folder === 'uploads') continue;
    const dir = path.join(imageRoot, folder);
    if (!fs.statSync(dir).isDirectory()) continue;
    const target = path.join(mediaDir, folder);
    fs.mkdirSync(target, { recursive: true });
    for (const file of fs.readdirSync(dir)) {
      const match = file.match(/^(.*)-(\d+)\.(png|jpe?g|webp)$/i);
      if (!match) continue;
      fs.copyFileSync(path.join(dir, file), path.join(target, file));
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

const images = collectImages();
const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
const catalog = {
  categories: categories.map((category) => ({
    slug: category.slug,
    name: category.name,
    blurb: category.blurb,
  })),
  products: products.map((product) => {
    const variants = product.variants.map((variant) => ({
      id: `${product.slug}:${variant.label}`,
      label: variant.label,
      weightGrams: variant.grams,
      pricePaise: variant.price,
      comparePaise: variant.compare,
    }));
    const from = variants.reduce((min, variant) => Math.min(min, variant.pricePaise), variants[0]?.pricePaise || 0);
    const category = categoryBySlug.get(product.category);
    return {
      slug: product.slug,
      name: product.name,
      description: product.description,
      featured: product.featured,
      images: images.get(product.slug) || [],
      category: { slug: product.category, name: category?.name || product.category },
      variants,
      fromPricePaise: from,
      fromComparePaise: variants.find((variant) => variant.pricePaise === from)?.comparePaise || from,
    };
  }),
};

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'catalog.json'), JSON.stringify(catalog));
console.log(`Static catalog: ${catalog.products.length} products`);
