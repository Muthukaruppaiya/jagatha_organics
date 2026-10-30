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
  const [sorts, setSorts] = useState({});
  const [fresh, setFresh] = useState('');
  const [freshSort, setFreshSort] = useState('');
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
      <p className="muted">Lower sort numbers show first on the shop.</p>
      {categories.map((category) => {
        const name = names[category.slug] ?? category.name;
        const sortValue = sorts[category.slug] ?? String(category.sortOrder ?? '');
        const dirty = name !== category.name || String(sortValue) !== String(category.sortOrder ?? '');
        return (
          <div key={category.slug} className="category-row">
            <input
              value={name}
              onChange={(event) => setNames((current) => ({ ...current, [category.slug]: event.target.value }))}
              aria-label={`Name for ${category.name}`}
            />
            <input
              value={sortValue}
              onChange={(event) => setSorts((current) => ({ ...current, [category.slug]: event.target.value.replace(/\D/g, '').slice(0, 4) }))}
              inputMode="numeric"
              aria-label={`Sort number for ${category.name}`}
              placeholder="Sort"
            />
            <small>{category.count} product{category.count === 1 ? '' : 's'}</small>
            <button
              type="button"
              className="btn ghost tiny"
              disabled={busy || !dirty}
              onClick={() => run(() => api.saveCategory(category.slug, { name, blurb: category.blurb, sortOrder: Number(sortValue) }))}
            >
              Save
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
        );
      })}
      <div className="category-row">
        <input value={fresh} onChange={(event) => setFresh(event.target.value)} placeholder="New category name" aria-label="New category name" />
        <input
          value={freshSort}
          onChange={(event) => setFreshSort(event.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          placeholder="Sort no."
          aria-label="Sort number"
        />
        <span />
        <button
          type="button"
          className="btn tiny"
          disabled={busy || fresh.trim().length < 2}
          onClick={() => run(async () => {
            await api.saveCategory(null, { name: fresh, sortOrder: freshSort ? Number(freshSort) : undefined });
            setFresh('');
            setFreshSort('');
          })}
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
        <Link className="btn ghost tiny" to="/admin/prices">Update prices</Link>
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

function priceDraft(list) {
  const next = {};
  for (const product of list || []) {
    for (const variant of product.variants || []) {
      next[variant.id] = {
        price: rupees(variant.pricePaise),
        compare: variant.comparePaise > variant.pricePaise ? rupees(variant.comparePaise) : '',
      };
    }
  }
  return next;
}

function lightestPack(product) {
  return [...(product?.variants || [])].sort((a, b) => (a.grams || 0) - (b.grams || 0))[0];
}

export function AdminPrices() {
  const person = readStaff();
  const [products, setProducts] = useState([]);
  const [draft, setDraft] = useState({});
  const [slug, setSlug] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.deskProducts()
      .then((list) => {
        setProducts(list);
        setDraft(priceDraft(list));
      })
      .catch((err) => setError(err.message));
  }, []);

  if (!person) return <Navigate to="/admin/login" replace />;
  if (person.role !== 'admin') return <Navigate to="/admin" replace />;

  const hay = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const map = new Map();
    for (const product of products) {
      if (hay && !`${product.name} ${product.category.name}`.toLowerCase().includes(hay)) continue;
      const key = product.category.name;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(product);
    }
    return [...map.entries()];
  }, [products, hay]);

  const product = products.find((item) => item.slug === slug);
  const packs = product ? [...product.variants].sort((a, b) => (a.grams || 0) - (b.grams || 0)) : [];
  const shopPack = lightestPack(product);
  const updates = [];
  for (const variant of packs) {
    const row = draft[variant.id];
    if (!row) continue;
    const pricePaise = paise(row.price);
    const comparePaise = paise(row.compare);
    if (pricePaise !== variant.pricePaise || comparePaise !== (variant.comparePaise > variant.pricePaise ? variant.comparePaise : 0)) {
      updates.push({ id: variant.id, pricePaise, comparePaise });
    }
  }

  function pick(next) {
    setSlug(next.slug);
    setSaved('');
    setError('');
  }

  function setPrice(id, key, value) {
    setDraft((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));
    setSaved('');
  }

  async function save(event) {
    event.preventDefault();
    if (!updates.length) return;
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const list = await api.savePrices(updates);
      setProducts(list);
      const savedProduct = list.find((item) => item.slug === product.slug);
      setDraft((current) => ({ ...current, ...priceDraft(savedProduct ? [savedProduct] : []) }));
      setSaved(`Saved ${updates.length} pack price${updates.length === 1 ? '' : 's'} for ${product.name}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      eyebrow="Catalogue"
      title="Set prices"
      lead="Select a product first, then set selling price and MRP for each pack. Shop cards keep the smallest pack price. The product page still lists the larger pack first."
    >
      <div className="price-desk">
        <aside className="price-pick">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a product" aria-label="Find a product" />
          {groups.map(([category, items]) => (
            <section key={category}>
              <h2>{category}</h2>
              {items.map((item) => {
                const from = lightestPack(item);
                return (
                  <button
                    key={item.slug}
                    type="button"
                    className={item.slug === slug ? 'on' : ''}
                    onClick={() => pick(item)}
                  >
                    {item.images[0] ? <img src={item.images[0]} alt="" /> : <span className="no-photo">No photo</span>}
                    <span>
                      <b>{item.name}</b>
                      <small>{from ? `${from.label} · ${inr(from.pricePaise)}` : 'No packs'}</small>
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
          {groups.length === 0 && <p className="muted">No products match that search.</p>}
        </aside>
        <form className="price-edit" onSubmit={save}>
          {!product && <p className="price-empty">Select a product, then set the pack prices.</p>}
          {product && (
            <>
              <header>
                {product.images[0] ? <img src={product.images[0]} alt="" /> : <span className="no-photo">No photo</span>}
                <div>
                  <p className="eyebrow">{product.category.name}</p>
                  <h2>{product.name}</h2>
                  {shopPack && <small>Shop card shows {shopPack.label} at {inr(shopPack.pricePaise)}</small>}
                </div>
              </header>
              {packs.map((variant) => (
                <fieldset key={variant.id} className="price-pack">
                  <legend>{variant.label}</legend>
                  <label>
                    Selling ₹
                    <input
                      inputMode="decimal"
                      value={draft[variant.id]?.price || ''}
                      onChange={(event) => setPrice(variant.id, 'price', event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    MRP ₹
                    <input
                      inputMode="decimal"
                      value={draft[variant.id]?.compare || ''}
                      onChange={(event) => setPrice(variant.id, 'compare', event.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                </fieldset>
              ))}
              {error && <p className="status error">{error}</p>}
              {saved && <p className="note">{saved}</p>}
              <button className="btn" type="submit" disabled={busy || !updates.length}>
                {busy ? 'Saving…' : updates.length ? `Save ${updates.length} pack price${updates.length === 1 ? '' : 's'}` : 'No changes'}
              </button>
            </>
          )}
        </form>
      </div>
    </AdminShell>
  );
}
