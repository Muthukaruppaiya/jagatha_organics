import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AdminShell } from './admin.jsx';
import { api, inr, readStaff } from './api.js';

const rupees = (paise) => (paise ? String(paise / 100) : '');
const paise = (value) => Math.round(Number(value || 0) * 100);

const NEW_PACKS = [
  { label: '200g', grams: '200', price: '', compare: '' },
  { label: '400g', grams: '400', price: '', compare: '' },
  { label: '800g', grams: '800', price: '', compare: '' },
];

function draftFrom(product, categorySlug) {
  if (!product) {
    return { name: '', categorySlug, description: '', active: true, featured: false, packs: NEW_PACKS.map((pack) => ({ ...pack })) };
  }
  return {
    name: product.name,
    categorySlug: product.category.slug,
    description: product.description,
    active: product.active,
    featured: product.featured,
    packs: product.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      grams: String(variant.grams),
      price: rupees(variant.pricePaise),
      compare: variant.comparePaise > variant.pricePaise ? rupees(variant.comparePaise) : '',
      stockQty: variant.stockQty,
    })),
  };
}

function bodyFrom(draft) {
  return {
    name: draft.name,
    categorySlug: draft.categorySlug,
    description: draft.description,
    active: draft.active,
    featured: draft.featured,
    variants: draft.packs.map((pack) => ({
      id: pack.id,
      label: pack.label,
      grams: Number(pack.grams),
      pricePaise: paise(pack.price),
      comparePaise: paise(pack.compare),
    })),
  };
}

function ProductEditor({ product, categories, defaultCategory, onSaved, onRemoved, onCancel }) {
  const [draft, setDraft] = useState(() => draftFrom(product, defaultCategory));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const setPack = (index, key, value) => setDraft((current) => ({
    ...current,
    packs: current.packs.map((pack, position) => (position === index ? { ...pack, [key]: value } : pack)),
  }));

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSaved(await api.saveProduct(product?.slug, bodyFrom(draft)), product?.slug);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${product.name}? It leaves the shop, the stock page, and every favourite list. Past orders keep its name.`)) return;
    setBusy(true);
    setError('');
    try {
      await api.removeProduct(product.slug);
      onRemoved(product.slug);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="glass form product-editor" onSubmit={save}>
      <div className="editor-head">
        <h2>{product ? `Edit ${product.name}` : 'New product'}</h2>
        {product && <Link className="btn ghost tiny" to={`/admin/images?product=${product.slug}`}>Photos ({product.images.length})</Link>}
      </div>
      <div className="banner-pair">
        <label>Name<input value={draft.name} onChange={(event) => set('name', event.target.value)} maxLength={120} required /></label>
        <label>
          Category
          <select value={draft.categorySlug} onChange={(event) => set('categorySlug', event.target.value)} required>
            {categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
          </select>
        </label>
      </div>
      <label>Description<textarea value={draft.description} onChange={(event) => set('description', event.target.value)} rows={3} maxLength={1000} /></label>
      <div className="check-pair">
        <label className="check-row"><input type="checkbox" checked={draft.active} onChange={(event) => set('active', event.target.checked)} /><span>Show in the shop</span></label>
        <label className="check-row"><input type="checkbox" checked={draft.featured} onChange={(event) => set('featured', event.target.checked)} /><span>Feature on the home page</span></label>
      </div>
      <div className="pack-table">
        <div className="pack-row pack-head">
          <span>Pack</span><span>Grams</span><span>Price (₹)</span><span>MRP (₹) <small>optional</small></span><span />
        </div>
        {draft.packs.map((pack, index) => (
          <div key={pack.id || `new-${index}`} className="pack-row">
            <input value={pack.label} onChange={(event) => setPack(index, 'label', event.target.value)} aria-label="Pack name" placeholder="200g" required />
            <input value={pack.grams} onChange={(event) => setPack(index, 'grams', event.target.value)} aria-label="Grams" inputMode="numeric" required />
            <input value={pack.price} onChange={(event) => setPack(index, 'price', event.target.value)} aria-label="Price in rupees" inputMode="decimal" placeholder="275" required />
            <input value={pack.compare} onChange={(event) => setPack(index, 'compare', event.target.value)} aria-label="MRP in rupees" inputMode="decimal" placeholder="330" />
            <button
              type="button"
              className="text"
              disabled={draft.packs.length < 2}
              onClick={() => set('packs', draft.packs.filter((_, position) => position !== index))}
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn ghost tiny" onClick={() => set('packs', [...draft.packs, { label: '', grams: '', price: '', compare: '' }])}>Add a pack size</button>
        <p className="muted">A new pack starts with 24 in stock. Change stock on the Stock page.</p>
      </div>
      {error && <p className="status error">{error}</p>}
      <div className="banner-actions">
        <button className="btn tiny" type="submit" disabled={busy}>{busy ? 'Saving…' : product ? 'Save changes' : 'Add product'}</button>
        <button className="btn ghost tiny" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        {product && <button className="text" type="button" onClick={remove} disabled={busy}>Delete product</button>}
      </div>
    </form>
  );
}

function CategoryDesk({ categories, onChange }) {
  const [names, setNames] = useState({});
  const [fresh, setFresh] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(work) {
    setBusy(true);
    setError('');
    try {
      await work();
      await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass form category-desk">
      <h2>Categories</h2>
      {categories.map((category) => (
        <div key={category.slug} className="category-row">
          <input
            value={names[category.slug] ?? category.name}
            onChange={(event) => setNames((current) => ({ ...current, [category.slug]: event.target.value }))}
            aria-label={`Name for ${category.name}`}
          />
          <small>{category.count} product{category.count === 1 ? '' : 's'}</small>
          <button
            type="button"
            className="btn ghost tiny"
            disabled={busy || (names[category.slug] ?? category.name) === category.name}
            onClick={() => run(() => api.saveCategory(category.slug, { name: names[category.slug], blurb: category.blurb }))}
          >
            Rename
          </button>
          <button
            type="button"
            className="text"
            disabled={busy || category.count > 0}
            title={category.count > 0 ? 'Move or delete its products first' : ''}
            onClick={() => window.confirm(`Delete the ${category.name} category?`) && run(() => api.removeCategory(category.slug))}
          >
            Delete
          </button>
        </div>
      ))}
      <div className="category-row">
        <input value={fresh} onChange={(event) => setFresh(event.target.value)} placeholder="New category name" aria-label="New category name" />
        <span />
        <button
          type="button"
          className="btn tiny"
          disabled={busy || fresh.trim().length < 2}
          onClick={() => run(async () => { await api.saveCategory(null, { name: fresh }); setFresh(''); })}
        >
          Add category
        </button>
        <span />
      </div>
      {error && <p className="status error">{error}</p>}
    </section>
  );
}

export function AdminProducts() {
  const person = readStaff();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [showCategories, setShowCategories] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  async function loadCategories() {
    setCategories(await api.deskCategories());
  }

  useEffect(() => {
    Promise.all([api.deskProducts(), api.deskCategories()])
      .then(([nextProducts, nextCategories]) => {
        setProducts(nextProducts);
        setCategories(nextCategories);
      })
      .catch((err) => setError(err.message));
  }, []);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return categories
      .filter((category) => !filter || category.slug === filter)
      .map((category) => ({
        category,
        items: products.filter((product) => product.category.slug === category.slug && (!needle || product.name.toLowerCase().includes(needle))),
      }))
      .filter((group) => group.items.length || (!needle && !filter));
  }, [categories, products, filter, q]);

  if (person && person.role !== 'admin') return <Navigate to="/admin" replace />;

  function saved(product, previousSlug) {
    setProducts((current) => (previousSlug
      ? current.map((item) => (item.slug === previousSlug ? product : item))
      : [...current, product]));
    setEditing(null);
    setNote(`${product.name} saved.`);
    loadCategories().catch(() => {});
  }

  function removed(slug) {
    setProducts((current) => current.filter((item) => item.slug !== slug));
    setEditing(null);
    setNote('Product deleted.');
    loadCategories().catch(() => {});
  }

  async function toggle(product) {
    setError('');
    try {
      const next = await api.saveProduct(product.slug, bodyFrom({ ...draftFrom(product), active: !product.active }));
      setProducts((current) => current.map((item) => (item.slug === product.slug ? next : item)));
      setNote(`${product.name} is ${next.active ? 'back in' : 'hidden from'} the shop.`);
    } catch (err) {
      setError(err.message);
    }
  }

  const shown = products.filter((product) => product.active).length;
  return (
    <AdminShell eyebrow="Catalog" title="Products" lead="Add products, change prices and pack sizes, hide a product from the shop, or delete it. Stock counts are on the Stock page and photos on the Images page.">
      <div className="desk-bar">
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Find a product" aria-label="Find a product" />
        <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Category">
          <option value="">Every category</option>
          {categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
        </select>
        <button className="btn ghost tiny" type="button" onClick={() => setShowCategories((value) => !value)}>Categories</button>
        <button className="btn tiny" type="button" onClick={() => setEditing('new')} disabled={!categories.length}>New product</button>
      </div>
      <p className="muted banner-count">{shown} of {products.length} products showing in the shop.</p>
      {note && <p className="note">{note}</p>}
      {error && <p className="status error">{error}</p>}
      {showCategories && <CategoryDesk categories={categories} onChange={loadCategories} />}
      {editing === 'new' && (
        <ProductEditor
          categories={categories}
          defaultCategory={filter || categories[0]?.slug || ''}
          onSaved={saved}
          onRemoved={removed}
          onCancel={() => setEditing(null)}
        />
      )}
      <div className="product-desk">
        {groups.map(({ category, items }) => (
          <section key={category.slug} className="product-group">
            <h2>{category.name} <small>{items.length}</small></h2>
            {items.length === 0 && <p className="empty desk-card">No products in this category yet.</p>}
            {items.map((product) => (editing === product.slug ? (
              <ProductEditor
                key={product.slug}
                product={product}
                categories={categories}
                onSaved={saved}
                onRemoved={removed}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <article key={product.slug} className={product.active ? 'product-row desk-card' : 'product-row desk-card off'}>
                {product.images[0] ? <img src={product.images[0]} alt="" /> : <span className="no-photo">No photo</span>}
                <div>
                  <b>{product.name}</b>
                  <div className="product-tags">
                    {!product.active && <span className="chip pay-expired">Hidden</span>}
                    {product.featured && <span className="chip">Featured</span>}
                    {product.images.length === 0 && <span className="chip pay-awaiting">Needs a photo</span>}
                  </div>
                  <small>{product.variants.map((variant) => `${variant.label} ${inr(variant.pricePaise)}`).join(' · ')}</small>
                  <small>Stock {product.variants.map((variant) => `${variant.label}: ${variant.stockQty}`).join(' · ')}</small>
                </div>
                <div className="product-actions">
                  <button className="btn tiny" type="button" onClick={() => setEditing(product.slug)}>Edit</button>
                  <Link className="btn ghost tiny" to={`/admin/images?product=${product.slug}`}>Photos</Link>
                  <button className="btn ghost tiny" type="button" onClick={() => toggle(product)}>{product.active ? 'Hide' : 'Show'}</button>
                </div>
              </article>
            )))}
          </section>
        ))}
      </div>
    </AdminShell>
  );
}
