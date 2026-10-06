import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AdminShell } from './admin.jsx';
import { api, inr, PAYMENT_LABEL, readStaff, ROLE_LABEL, sourceLabel, STATUS_LABEL, when } from './api.js';

function useGuard(roles) {
  const person = readStaff();
  if (person && !roles.includes(person.role)) return <Navigate to="/admin" replace />;
  return null;
}

export function AdminInventory() {
  const blocked = useGuard(['admin', 'billing']);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [qty, setQty] = useState({});
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState(0);

  function load() {
    return api.inventory().then(setRows).catch((err) => setError(err.message));
  }

  useEffect(() => { load(); }, []);

  const visible = rows.filter((row) => {
    const hay = `${row.productName} ${row.label} ${row.category}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });
  const groups = useMemo(() => {
    const map = new Map();
    for (const row of visible) {
      if (!map.has(row.productSlug)) {
        map.set(row.productSlug, {
          name: row.productName,
          category: row.category,
          imageUrl: row.imageUrl,
          packs: [],
        });
      }
      map.get(row.productSlug).packs.push(row);
    }
    return [...map.values()];
  }, [visible]);
  const lowCount = rows.filter((row) => row.stockQty <= 8).length;
  const units = rows.reduce((sum, row) => sum + row.stockQty, 0);

  async function save(variantId) {
    const quantity = Number(qty[variantId]);
    setBusyId(variantId);
    setError('');
    setNote('');
    try {
      const result = await api.adjustStock({ variantId, quantity, note: 'Kitchen stock update' });
      setRows((current) => current.map((row) => (row.variantId === variantId ? { ...row, stockQty: result.stockQty } : row)));
      setQty((current) => ({ ...current, [variantId]: '' }));
      setNote(`${result.label} is now ${result.stockQty} in stock.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(0);
    }
  }

  if (blocked) return blocked;
  return (
    <AdminShell eyebrow="Stock" title="Inventory" lead="Add a positive number when a batch arrives. Use a minus to correct a count. Website, WhatsApp, and counter sales reduce stock on their own.">
      <div className="desk-stats">
        <article><span>Products</span><strong>{new Set(rows.map((row) => row.productSlug)).size}</strong></article>
        <article><span>Packs on hand</span><strong>{units}</strong></article>
        <article><span>Low stock</span><strong className={lowCount ? 'low' : ''}>{lowCount}</strong></article>
        <article><span>Showing</span><strong>{groups.length}</strong></article>
      </div>
      <div className="desk-bar">
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search a laddu, bar, or snack" aria-label="Search inventory" />
      </div>
      {error && <p className="status error">{error}</p>}
      {note && <p className="note">{note}</p>}
      <div className="stock-board">
        {groups.map((group) => (
          <article key={group.name} className="stock-card">
            {group.imageUrl && <img src={group.imageUrl} alt="" />}
            <div>
              <p className="chip">{group.category}</p>
              <h2>{group.name}</h2>
              <div className="pack-grid">
                {group.packs.map((row) => (
                  <div key={row.variantId} className={row.stockQty <= 8 ? 'pack-tile low-tile' : 'pack-tile'}>
                    <span>{row.label}</span>
                    <b className={row.stockQty <= 8 ? 'count low' : 'count'}>{row.stockQty}</b>
                    <small>{row.stockQty <= 8 ? 'Low' : 'In stock'}</small>
                    <div className="adjust">
                      <input
                        type="number"
                        inputMode="numeric"
                        aria-label={`Quantity for ${row.productName} ${row.label}`}
                        value={qty[row.variantId] || ''}
                        placeholder="+12"
                        onChange={(event) => setQty((current) => ({ ...current, [row.variantId]: event.target.value }))}
                      />
                      <button className="btn tiny" type="button" disabled={busyId === row.variantId || !qty[row.variantId]} onClick={() => save(row.variantId)}>
                        {busyId === row.variantId ? '…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </AdminShell>
  );
}

export function AdminImages() {
  const blocked = useGuard(['admin']);
  const [products, setProducts] = useState([]);
  const [slug, setSlug] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.products()
      .then((list) => {
        setProducts(list);
        setSlug(list[0]?.slug || '');
      })
      .catch((err) => setError(err.message));
  }, []);

  const product = products.find((item) => item.slug === slug) || products[0];
  const picks = products.filter((item) => item.name.toLowerCase().includes(q.trim().toLowerCase()));

  async function upload(event) {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (!files.length || !product) return;
    setBusy(true);
    setError('');
    try {
      let images = product.images;
      for (const file of files) {
        const result = await api.uploadImage(product.slug, file);
        images = result.images;
      }
      setProducts((current) => current.map((item) => (item.slug === product.slug ? { ...item, images } : item)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(url) {
    if (!product) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.removeImage(product.slug, url);
      setProducts((current) => current.map((item) => (item.slug === product.slug ? { ...item, images: result.images } : item)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (blocked) return blocked;
  return (
    <AdminShell eyebrow="Catalog" title="Images" lead="Choose a product, then add one or more photos. JPG, PNG, or WebP, up to 8 MB each.">
      <div className="photo-desk">
        <aside className="photo-list">
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Find a product" aria-label="Find a product" />
          {picks.map((item) => (
            <button key={item.slug} type="button" className={item.slug === product?.slug ? 'photo-pick on' : 'photo-pick'} onClick={() => setSlug(item.slug)}>
              {item.images[0] && <img src={item.images[0]} alt="" />}
              <span>{item.name}<small>{item.images.length} photo{item.images.length === 1 ? '' : 's'}</small></span>
            </button>
          ))}
        </aside>
        <section>
          <label className="drop-zone">
            <b>{product?.name || 'Product'}</b>
            <span>{busy ? 'Uploading…' : 'Choose photos for this pack'}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={upload} disabled={busy || !product} />
          </label>
          {error && <p className="status error">{error}</p>}
          <div className="image-grid">
            {(product?.images || []).map((src) => (
              <figure key={src} className="glass">
                <img src={src} alt="" />
                <button type="button" className="text" disabled={busy} onClick={() => remove(src)}>Remove</button>
              </figure>
            ))}
            {product && product.images.length === 0 && <p className="empty">No photos yet.</p>}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

export function AdminReports() {
  const blocked = useGuard(['admin', 'billing']);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState(null);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    api.reports(from, to)
      .then((next) => { if (live) setReport(next); })
      .catch((err) => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [from, to]);

  if (blocked) return blocked;
  return (
    <AdminShell eyebrow="Numbers" title="Reports" lead="Website checkout, WhatsApp orders, and counter bills, side by side.">
      <div className="date-range">
        <label>From<input type="date" value={from || report?.from || ''} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To<input type="date" value={to || report?.to || ''} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      <div className="desk-tabs">
        <button type="button" className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>Overview</button>
        <button type="button" className={tab === 'sales' ? 'on' : ''} onClick={() => setTab('sales')}>Sales report</button>
        <button type="button" className={tab === 'revenue' ? 'on' : ''} onClick={() => setTab('revenue')}>Revenue report</button>
      </div>
      {error && <p className="status error">{error}</p>}
      {report && tab === 'overview' && (
        <>
          <div className="desk-stats">
            <article><span>Website</span><strong>{report.onlineOrders}</strong><small>{inr(report.onlinePaise)}</small></article>
            <article><span>WhatsApp</span><strong>{report.whatsappOrders || 0}</strong><small>{inr(report.whatsappPaise || 0)}</small></article>
            <article><span>Store bills</span><strong>{report.storeBills}</strong><small>{inr(report.storePaise)}</small></article>
            <article><span>Taken together</span><strong>{inr(report.onlinePaise + (report.whatsappPaise || 0) + report.storePaise)}</strong><small>{report.cancelled} cancelled</small></article>
          </div>
          <div className="split report-split">
            <div className="glass summary">
              <h2>Top packs</h2>
              {report.top.length === 0 && <p className="muted">No sales in this range.</p>}
              {report.top.map((item) => (
                <p key={item.name}><span>{item.name} × {item.quantity}</span><b>{inr(item.paise)}</b></p>
              ))}
            </div>
            <div className="glass summary">
              <h2>Low stock</h2>
              {report.lowStock.length === 0 && <p className="muted">Nothing is at 8 or below.</p>}
              {report.lowStock.map((item) => (
                <p key={`${item.name}-${item.label}`}><span>{item.name} · {item.label}</span><b className="low">{item.stockQty}</b></p>
              ))}
            </div>
          </div>
        </>
      )}
      {report && tab === 'sales' && (
        <div className="order-board">
          {(report.sales || []).length === 0 && <p className="empty desk-card">No sales in this range.</p>}
          {(report.sales || []).map((order) => (
            <Link key={order.orderNumber} to={`/admin/orders/${order.orderNumber}`} className="order-card">
              <span className="avatar">{order.customerName.slice(0, 1)}</span>
              <div>
                <b>{order.orderNumber} · {order.customerName}</b>
                <small>{when(order.createdAt)}</small>
              </div>
              <span className={`chip ${order.channel}`}>{sourceLabel(order.channel)}</span>
              <span className={`tag ${order.status}`}>{STATUS_LABEL[order.status]}</span>
              <strong>{inr(order.totalPaise)}</strong>
            </Link>
          ))}
        </div>
      )}
      {report && tab === 'revenue' && (
        <section className="glass summary">
          <h2>Revenue by day</h2>
          {(report.daily || []).length === 0 && <p className="muted">No revenue in this range.</p>}
          <div className="bars">
            {(report.daily || []).map((day) => {
              const max = Math.max(...report.daily.map((item) => item.paise), 1);
              return (
                <div key={day.date} className="bar-col">
                  <div className="bar" style={{ height: `${Math.max(10, (day.paise / max) * 150)}px` }} title={inr(day.paise)} />
                  <b>{inr(day.paise)}</b>
                  <small>{day.date.slice(5)} · {day.orders}</small>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </AdminShell>
  );
}

export function AdminBilling() {
  const blocked = useGuard(['admin', 'billing']);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [lines, setLines] = useState([]);
  const [customerName, setCustomerName] = useState('Walk-in');
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    api.products().then(setProducts).catch((err) => setError(err.message));
  }, []);

  const choices = useMemo(() => products.filter((product) => {
    const hay = `${product.name} ${product.category.name}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  }).slice(0, 18), [products, q]);

  function addPack(product, variant) {
    setReceipt(null);
    setLines((current) => {
      const found = current.find((line) => line.variantId === variant.id);
      if (found) {
        return current.map((line) => (line.variantId === variant.id ? { ...line, quantity: Math.min(50, line.quantity + 1) } : line));
      }
      return [...current, {
        variantId: variant.id,
        name: product.name,
        label: variant.label,
        pricePaise: variant.pricePaise,
        quantity: 1,
        stockQty: variant.stockQty,
      }];
    });
  }

  const total = lines.reduce((sum, line) => sum + line.pricePaise * line.quantity, 0);

  async function bill(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const order = await api.createBill({
        customerName,
        phone,
        paymentMethod,
        notes,
        items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
      });
      setReceipt(order);
      setLines([]);
      setNotes('');
      const fresh = await api.products();
      setProducts(fresh);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (blocked) return blocked;
  return (
    <AdminShell eyebrow="Counter" title="Store billing" lead="Tap a weight to add it. Collect cash or UPI, then save the bill.">
      <div className="pos">
        <div>
          <input className="pos-search" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search the shelf" aria-label="Search products" />
          <div className="pos-grid">
            {choices.map((product) => (
              <article key={product.slug} className="pos-tile">
                {product.images[0] && <img src={product.images[0]} alt="" />}
                <b>{product.name}</b>
                <div className="pos-weights">
                  {product.variants.map((variant) => (
                    <button key={variant.id} type="button" onClick={() => addPack(product, variant)} disabled={variant.stockQty < 1}>
                      <b>{variant.label}</b>
                      <span>{variant.stockQty < 1 ? 'Out' : inr(variant.pricePaise)}</span>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
        <form className="glass form pos-bill" onSubmit={bill}>
          <h2>Current bill</h2>
          {lines.length === 0 && <p className="muted">Tap a pack on the left.</p>}
          {lines.map((line) => (
            <div key={line.variantId} className="bill-line">
              <span>{line.name}<small>{line.label}</small></span>
              <input
                type="number"
                min="1"
                max="50"
                aria-label={`Quantity for ${line.name}`}
                value={line.quantity}
                onChange={(event) => setLines((current) => current.map((item) => (
                  item.variantId === line.variantId ? { ...item, quantity: Number(event.target.value) } : item
                )))}
              />
              <b>{inr(line.pricePaise * line.quantity)}</b>
              <button type="button" className="text" onClick={() => setLines((current) => current.filter((item) => item.variantId !== line.variantId))}>Remove</button>
            </div>
          ))}
          <label>Customer<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
          <label>Mobile<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="Optional, so they can track" /></label>
          <div className="pay-toggle" role="group" aria-label="Payment">
            <button type="button" className={paymentMethod === 'cash' ? 'on' : ''} onClick={() => setPaymentMethod('cash')}>Cash</button>
            <button type="button" className={paymentMethod === 'upi' ? 'on' : ''} onClick={() => setPaymentMethod('upi')}>UPI</button>
          </div>
          <label>Note<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} /></label>
          <p className="total pos-total"><span>To collect</span><b>{inr(total)}</b></p>
          {error && <p className="status error">{error}</p>}
          <button className="btn" type="submit" disabled={busy || lines.length === 0}>{busy ? 'Saving…' : 'Save bill'}</button>
        </form>
      </div>
      {receipt && (
        <article className="glass summary receipt">
          <p className="eyebrow">Receipt</p>
          <h2>{receipt.orderNumber}</h2>
          <p>{receipt.customerName}{receipt.phone ? ` · ${receipt.phone}` : ''}</p>
          <ul className="mini-lines">
            {receipt.items.map((item, index) => (
              <li key={`${item.productSlug}-${index}`}>
                <span>{item.productName}<small>{item.variantLabel} × {item.quantity}</small></span>
                <b>{inr(item.unitPricePaise * item.quantity)}</b>
              </li>
            ))}
          </ul>
          <p className="total"><span>{PAYMENT_LABEL[receipt.paymentMethod]}</span><b>{inr(receipt.totalPaise)}</b></p>
          <button className="btn no-print" type="button" onClick={() => window.print()}>Print bill</button>
        </article>
      )}
    </AdminShell>
  );
}

export function AdminStaff() {
  const blocked = useGuard(['admin']);
  const [people, setPeople] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('billing');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    api.staffList().then(setPeople).catch((err) => setError(err.message));
  }

  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSaved('');
    try {
      await api.createStaff({ name, email, password, role });
      setSaved(`${name} can sign in as ${ROLE_LABEL[role]}.`);
      setName('');
      setEmail('');
      setPassword('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (blocked) return blocked;
  return (
    <AdminShell eyebrow="Access" title="Staff" lead="Billing staff run the counter and stock. Delivery staff update packing and the courier the customer sees.">
      <div className="split">
        <div className="order-table glass">
          {people.map((person) => (
            <div key={person.email} className="order-row">
              <div>
                <b>{person.name}</b>
                <small>{person.email}</small>
              </div>
              <span className="tag">{ROLE_LABEL[person.role] || person.role}</span>
              <small>{when(person.createdAt)}</small>
            </div>
          ))}
        </div>
        <form className="glass form" onSubmit={submit}>
          <h2>Add a person</h2>
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
          <label>Role
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="billing">Billing staff</option>
              <option value="delivery">Delivery staff</option>
              <option value="admin">Owner</option>
            </select>
          </label>
          {error && <p className="status error">{error}</p>}
          {saved && <p className="note">{saved}</p>}
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add staff'}</button>
        </form>
      </div>
    </AdminShell>
  );
}

export function AdminVideos() {
  const blocked = useGuard(['admin']);
  const [clips, setClips] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    api.videos().then(setClips).catch((err) => setError(err.message));
  }

  useEffect(() => { load(); }, []);

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await api.uploadVideo(title || file.name.replace(/\.mp4$/i, ''), file);
      setTitle('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    setBusy(true);
    setError('');
    try {
      await api.removeVideo(id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (blocked) return blocked;
  return (
    <AdminShell eyebrow="Homepage" title="Videos" lead="These clips play on the home page. Upload an MP4, up to 40 MB, and it replaces the fixed set.">
      <div className="drop-zone video-add">
        <label>Caption<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Millet laddus" /></label>
        <label className="btn file-btn">
          {busy ? 'Uploading…' : 'Upload MP4'}
          <input type="file" accept="video/mp4" onChange={upload} disabled={busy} />
        </label>
      </div>
      {error && <p className="status error">{error}</p>}
      <div className="video-grid">
        {clips.map((clip) => (
          <article key={clip.id} className="glass">
            <video src={clip.src} muted playsInline controls />
            <b>{clip.title}</b>
            <button type="button" className="text" disabled={busy} onClick={() => remove(clip.id)}>Remove from the home page</button>
          </article>
        ))}
      </div>
    </AdminShell>
  );
}

export function AdminReviews() {
  const blocked = useGuard(['admin', 'billing']);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');

  function load() {
    api.deskReviews().then(setReviews).catch((err) => setError(err.message));
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id, status) {
    setError('');
    try {
      const next = await api.moderateReview(id, status);
      setReviews((current) => current.map((review) => (review.id === id ? { ...review, status: next.status } : review)));
    } catch (err) {
      setError(err.message);
    }
  }

  if (blocked) return blocked;
  return (
    <AdminShell eyebrow="Customers" title="Reviews" lead="Approve a review to show it on the product page. Hide keeps it off the shop.">
      {error && <p className="status error">{error}</p>}
      <div className="order-board">
        {reviews.length === 0 && <p className="empty desk-card">No reviews yet.</p>}
        {reviews.map((review) => (
          <article key={review.id} className="desk-card review-desk">
            <div>
              <b>{review.productName}</b>
              <small>{review.customerName} · {review.rating}/5 · {review.status}</small>
              <p>{review.body}</p>
            </div>
            <div className="review-actions">
              <button type="button" className="btn tiny" onClick={() => setStatus(review.id, 'approved')}>Approve</button>
              <button type="button" className="btn ghost tiny" onClick={() => setStatus(review.id, 'rejected')}>Hide</button>
            </div>
          </article>
        ))}
      </div>
    </AdminShell>
  );
}
