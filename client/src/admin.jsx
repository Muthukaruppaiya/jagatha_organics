import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, NavLink, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { OrderTimeline } from './checkout.jsx';
import { downloadCsv } from './csv.js';
import { PrintSheet } from './print.jsx';
import { addressText, api, clearStaff, forgetStaff, inr, PAYMENT_STATUS_LABEL, paymentLabel, readStaff, ROLE_LABEL, saveStaff, sourceLabel, STATUS_LABEL, whatsAppLink, when } from './api.js';

const STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];

export function signedIn() {
  return Boolean(readStaff()?.role);
}

export function clearDesk() {
  clearStaff();
}

export function expireDesk(navigate) {
  clearDesk();
  navigate('/admin/login', { replace: true });
}

export function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.staffMe()
      .then((staff) => saveStaff(staff))
      .catch(() => forgetStaff())
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <div className="login-stage"><p className="muted">Opening the desk…</p></div>;
  if (signedIn()) return <Navigate to="/admin" replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.login(email, password);
      saveStaff(result.staff);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-stage">
      <section className="login-hero">
        <p className="eyebrow">Jagatha Organics</p>
        <h1>The kitchen desk.</h1>
        <p>Orders, stock, counter bills, and courier details in one place.</p>
      </section>
      <form className="glass form login-card" onSubmit={submit}>
        <p className="eyebrow">Sign in</p>
        <h2>Welcome back</h2>
        <p className="muted">Owner, billing staff, or delivery staff.</p>
        <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" required /></label>
        <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required /></label>
        {error && <p className="status error">{error}</p>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <Link to="/">Back to the shop</Link>
      </form>
    </div>
  );
}

const ICONS = {
  orders: 'M6 4h12v16H6zM9 8h6M9 12h6M9 16h4',
  // billing: 'M5 7h14v12H5zM5 11h14M8 15h3',
  inventory: 'M4 8l8-4 8 4-8 4zM4 12l8 4 8-4M4 16l8 4 8-4',
  images: 'M4 6h16v12H4zM8 14l2.5-3 2 2.2L16 9l4 5',
  reports: 'M5 19V9M12 19V5M19 19v-6',
  settings: 'M12 8.5a3.5 3.5 0 1 0 3.5 3.5A3.5 3.5 0 0 0 12 8.5zM4 12h2M18 12h2M12 4v2M12 18v2',
  staff: 'M12 12a3.2 3.2 0 1 0-3.2-3.2A3.2 3.2 0 0 0 12 12zM6 19c.6-2.4 2.8-4 6-4s5.4 1.6 6 4',
  videos: 'M5 6h10v12H5zM15 10l5-2v8l-5-2z',
  banners: 'M3 6h18v12H3zM7 10h6M7 14h4',
  products: 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10',
  prices: 'M12 3v18M8 8h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8',
  reviews: 'M6 5h12v10H9l-3 3z',
};

const LINKS = [
  { to: '/admin', label: 'Orders', icon: 'orders', end: true, roles: ['admin', 'billing', 'delivery'] },
  // { to: '/admin/billing', label: 'Store billing', icon: 'billing', roles: ['admin', 'billing'] },
  { to: '/admin/products', label: 'Products', icon: 'products', roles: ['admin'] },
  { to: '/admin/prices', label: 'Prices', icon: 'prices', roles: ['admin'] },
  { to: '/admin/inventory', label: 'Stock', icon: 'inventory', roles: ['admin', 'billing'] },
  { to: '/admin/images', label: 'Images', icon: 'images', roles: ['admin'] },
  { to: '/admin/banners', label: 'Banners', icon: 'banners', roles: ['admin'] },
  { to: '/admin/videos', label: 'Videos', icon: 'videos', roles: ['admin'] },
  { to: '/admin/reviews', label: 'Reviews', icon: 'reviews', roles: ['admin', 'billing'] },
  { to: '/admin/reports', label: 'Reports', icon: 'reports', roles: ['admin', 'billing'] },
  { to: '/admin/settings', label: 'Settings', icon: 'settings', roles: ['admin'] },
  { to: '/admin/staff', label: 'Staff', icon: 'staff', roles: ['admin'] },
];

export function AdminShell({ eyebrow, title, lead, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [person, setPerson] = useState(() => readStaff());
  const [ready, setReady] = useState(Boolean(readStaff()?.role));
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    let live = true;
    api.staffMe()
      .then((staff) => {
        if (!live) return;
        saveStaff(staff);
        setPerson(staff);
        setReady(true);
      })
      .catch(() => {
        if (!live) return;
        forgetStaff();
        setPerson(null);
        setReady(true);
      });
    return () => { live = false; };
  }, []);
  if (!ready) return <div className="login-stage"><p className="muted">Opening the desk…</p></div>;
  if (!person?.role) return <Navigate to="/admin/login" replace />;
  const links = LINKS.filter((link) => link.roles.includes(person.role));

  function logout() {
    clearDesk();
    navigate('/admin/login');
  }

  return (
    <div className="admin">
      <aside className="admin-side">
        <Link to="/" className="brand"><span className="mark" /><span><strong>Jagatha</strong><small>{ROLE_LABEL[person.role]}</small></span></Link>
        <p className="side-label">Desk</p>
        <nav>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => (isActive ? 'side-on' : '')}>
              <svg className="nav-ico" viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[link.icon]} /></svg>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="side-person">
            <span className="avatar">{person.name.slice(0, 1)}</span>
            <span><b>{person.name}</b><small>{ROLE_LABEL[person.role]}</small></span>
          </div>
          <button type="button" className="text" onClick={logout}>Sign out</button>
          <Link className="shop-link" to="/shop">View shop</Link>
        </div>
      </aside>
      <section className="admin-main">
        <header className="admin-top">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            {lead && <p className="desk-lead">{lead}</p>}
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}

export function AdminHome() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    Promise.all([api.summary(), api.orders({ status, q })])
      .then(([nextSummary, nextOrders]) => {
        if (!live) return;
        setSummary(nextSummary);
        setOrders(nextOrders);
      })
      .catch((err) => {
        if (!live) return;
        if (/sign in/i.test(err.message)) expireDesk(navigate);
        else setError(err.message);
      });
    return () => { live = false; };
  }, [status, q, navigate]);

  return (
    <AdminShell eyebrow="Desk" title="Orders" lead="Website orders land here. Pack an order once it shows Paid; unpaid orders cancel themselves after 30 minutes and return their stock.">
      {summary && (
        <div className="desk-stats no-print">
          <article><span>Open queue</span><strong>{summary.pending}</strong></article>
          <article><span>In progress</span><strong>{summary.open}</strong></article>
          <article><span>All orders</span><strong>{summary.total}</strong></article>
          <article><span>Active value</span><strong>{inr(summary.revenuePaise)}</strong></article>
        </div>
      )}
      <div className="desk-bar no-print">
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name, phone, JO number" aria-label="Search orders" />
        <select value={status} aria-label="Filter by status" onChange={(event) => setStatus(event.target.value)}>
          <option value="">Every status</option>
          {STATUSES.map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}
        </select>
        <button
          type="button"
          className="btn tiny"
          disabled={!orders.length}
          onClick={() => downloadCsv(`jagatha-orders.csv`, [
            ['Order', 'Customer', 'Phone', 'City', 'Status', 'Payment', 'Total', 'Placed'],
            ...orders.map((order) => [
              order.orderNumber,
              order.customerName,
              order.phone || '',
              order.city || '',
              STATUS_LABEL[order.status] || order.status,
              order.paymentStatus ? PAYMENT_STATUS_LABEL[order.paymentStatus] : sourceLabel(order.channel),
              (order.totalPaise || 0) / 100,
              when(order.createdAt),
            ]),
          ])}
        >
          Export CSV
        </button>
        <button type="button" className="btn tiny ghost" disabled={!orders.length} onClick={() => window.print()}>Print list</button>
      </div>
      {error && <p className="status error">{error}</p>}
      <div className="order-board no-print">
        {orders.length === 0 && <p className="empty desk-card">No orders in this view yet.</p>}
        {orders.map((order) => (
          <Link key={order.orderNumber} to={`/admin/orders/${order.orderNumber}`} className="order-card">
            <span className="avatar">{order.customerName.slice(0, 1)}</span>
            <div>
              <b>{order.orderNumber} · {order.customerName}</b>
              <small>{when(order.createdAt)} · {order.phone || 'No phone'} · {order.city}</small>
            </div>
            <span className={`chip pay-${order.paymentStatus || order.channel || 'online'}`}>
              {order.paymentStatus ? PAYMENT_STATUS_LABEL[order.paymentStatus] : sourceLabel(order.channel)}
            </span>
            <span className={`tag ${order.status}`}>{STATUS_LABEL[order.status]}</span>
            <strong>{inr(order.totalPaise)}</strong>
          </Link>
        ))}
      </div>
      <section className="print-sheet list">
        <h1>Jagatha Organics · Orders</h1>
        <table className="print-lines">
          <thead>
            <tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th></tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.orderNumber}>
                <td>{order.orderNumber}</td>
                <td>{order.customerName}<small>{order.phone} · {order.city}</small></td>
                <td>{STATUS_LABEL[order.status]}</td>
                <td>{inr(order.totalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}

function shopEmail(email) {
  if (!email || /@phone\.jagathaorganics\.com$/i.test(email)) return '';
  return email;
}

export function AdminOrder() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState(() => readStaff());
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('pending');
  const [note, setNote] = useState('');
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState('');
  const [busy, setBusy] = useState(false);
  const [shop, setShop] = useState(null);
  const [printKind, setPrintKind] = useState('invoice');
  const delivery = person?.role === 'delivery';
  const canCourier = person?.role === 'admin' || delivery;

  useEffect(() => {
    const sync = () => setPerson(readStaff());
    window.addEventListener('jagatha-session', sync);
    return () => window.removeEventListener('jagatha-session', sync);
  }, []);

  useEffect(() => {
    api.settings().then((data) => setShop(data.shop)).catch(() => {});
    api.order(orderNumber)
      .then((next) => {
        setOrder(next);
        setStatus(next.status);
        setNote(next.adminNote || '');
        setCourierName(next.courierName || '');
        setTrackingNumber(next.trackingNumber || '');
        setTrackingUrl(next.trackingUrl || '');
      })
      .catch((err) => {
        if (/sign in/i.test(err.message)) expireDesk(navigate);
        else setError(err.message);
      });
  }, [orderNumber, navigate]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    setError('');
    try {
      const body = { status };
      if (!delivery) body.adminNote = note;
      if (canCourier && status === 'shipped') {
        body.courierName = courierName;
        body.trackingNumber = trackingNumber;
        body.trackingUrl = trackingUrl;
      }
      const next = await api.updateOrder(orderNumber, body);
      setOrder(next);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyText(label, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 2000);
    } catch {
      setError('Could not copy. Copy it from the page instead.');
    }
  }

  if (error && !order) {
    return (
      <AdminShell eyebrow="Order" title="Not found">
        <p className="status error">{error}</p>
        <Link className="text-btn" to="/admin">Back to orders</Link>
      </AdminShell>
    );
  }
  if (!order) {
    return (
      <AdminShell eyebrow="Order" title="Loading">
        <p className="status">Loading order…</p>
      </AdminShell>
    );
  }

  const statusOptions = delivery
    ? [...new Set([order.status, 'packed', 'shipped', 'delivered'])]
    : STATUSES;
  const email = shopEmail(order.email);
  const goodsPaise = order.items.reduce((sum, item) => sum + item.unitPricePaise * item.quantity, 0);
  const trackUrl = /^https?:\/\//i.test(order.trackingUrl || '') ? order.trackingUrl : '';
  const askCourier = canCourier && status === 'shipped';
  const hasCourier = Boolean(order.courierName || order.trackingNumber || trackUrl);
  const waHref = order.phone
    ? whatsAppLink(order.phone, `Hello ${order.customerName}, this is Jagatha Organics about order ${order.orderNumber}.`)
    : '';

  return (
    <AdminShell
      eyebrow={when(order.createdAt)}
      title={order.orderNumber}
      lead={`${order.customerName} · ${paymentLabel(order)}`}
    >
      <div className="order-hero no-print">
        <div className="tag-row">
          <span className={`tag ${order.status}`}>{STATUS_LABEL[order.status]}</span>
          <span className={`chip pay-${order.paymentStatus || 'awaiting'}`}>
            {order.paymentStatus ? PAYMENT_STATUS_LABEL[order.paymentStatus] : sourceLabel(order.channel)}
          </span>
          <span className="chip">{sourceLabel(order.channel)}</span>
        </div>
        <div className="order-hero-actions no-print">
          <button type="button" className="btn tiny ghost" onClick={() => { setPrintKind('invoice'); window.setTimeout(() => window.print(), 50); }}>Print invoice</button>
          <button type="button" className="btn tiny ghost" onClick={() => { setPrintKind('slip'); window.setTimeout(() => window.print(), 50); }}>Print packing slip</button>
          <Link className="text-btn" to="/admin">All orders</Link>
        </div>
      </div>

      <div className="order-desk no-print">
        <div className="order-desk-main">
          <section className="glass order-card-block">
            <h2>Packs</h2>
            <ul className="order-packs">
              {order.items.map((item, index) => (
                <li key={`${item.productSlug}-${index}`}>
                  {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="order-pack-ph" aria-hidden="true" />}
                  <div>
                    <b>{item.productName}</b>
                    <small>{item.variantLabel} × {item.quantity}</small>
                    <small>{inr(item.unitPricePaise)} each</small>
                  </div>
                  <strong>{inr(item.unitPricePaise * item.quantity)}</strong>
                </li>
              ))}
            </ul>
            <div className="order-money">
              <p><span>Items</span><b>{inr(goodsPaise)}</b></p>
              <p><span>Delivery</span><b>{order.shippingPaise ? inr(order.shippingPaise) : 'Free'}</b></p>
              <p className="grand"><span>Total</span><b>{inr(order.totalPaise)}</b></p>
            </div>
            {order.notes && (
              <div className="order-note">
                <small>Customer note</small>
                <p>{order.notes}</p>
              </div>
            )}
          </section>

          <section className="glass order-card-block">
            <h2>Progress</h2>
            <OrderTimeline order={order} />
            {(order.courierName || order.trackingNumber || trackUrl) && (
              <div className="desk-courier-read">
                {order.courierName && <p><small>Courier</small><b>{order.courierName}</b></p>}
                {order.trackingNumber && <p><small>Tracking number</small><b>{order.trackingNumber}</b></p>}
                {trackUrl && <a className="btn tiny" href={trackUrl} target="_blank" rel="noreferrer">Open tracking link</a>}
              </div>
            )}
          </section>
        </div>

        <form className="glass order-card-block order-desk-form" onSubmit={save}>
          <div className="customer-head">
            <span className="avatar">{order.customerName.slice(0, 1)}</span>
            <div>
              <h2>{order.customerName}</h2>
              {order.addressType && <span className="chip">{order.addressType}</span>}
            </div>
          </div>

          <div className="contact-actions">
            {order.phone && <a className="btn tiny" href={`tel:+91${order.phone}`}>Call {order.phone}</a>}
            {waHref && <a className="btn tiny wa" href={waHref} target="_blank" rel="noreferrer">WhatsApp</a>}
            {email && <a className="btn tiny ghost" href={`mailto:${email}`}>Email</a>}
          </div>
          {email && <p className="muted mail-line"><a href={`mailto:${email}`}>{email}</a></p>}
          {order.altPhone && <p className="muted">Alternate: <a href={`tel:+91${order.altPhone}`}>{order.altPhone}</a></p>}

          <div className="addr-block">
            <small>Delivery address</small>
            <p>{addressText(order)}</p>
            <button className="text-btn" type="button" onClick={() => copyText('address', `${order.customerName}\n${addressText(order)}\n+91 ${order.phone}`)}>
              {copied === 'address' ? 'Copied' : 'Copy address'}
            </button>
          </div>

          <div className="desk-section">
            <small>Status</small>
            <div className="status-steps">
              {statusOptions.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`${item}${status === item ? ' on' : ''}`}
                  onClick={() => setStatus(item)}
                >
                  {STATUS_LABEL[item]}
                </button>
              ))}
            </div>
          </div>

          {!delivery && (
            <label>Desk note
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Called, will pack tomorrow…" />
            </label>
          )}

          {askCourier ? (
            <div className="courier-card">
              <div>
                <b>Courier details</b>
                <span className="opt-pill">Optional</span>
                <p className="muted">Add these if you have them. You can mark the order shipped without a courier name, tracking number, or link.</p>
              </div>
              <div className="courier-fields">
                <label>Courier name
                  <input value={courierName} onChange={(event) => setCourierName(event.target.value)} placeholder="Delhivery, DTDC, India Post" />
                </label>
                <label>Tracking number
                  <input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="AWB or consignment number" />
                </label>
                <label className="wide">Tracking link
                  <input value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} placeholder="https://" inputMode="url" />
                </label>
              </div>
            </div>
          ) : hasCourier ? (
            <div className="courier-card read">
              <b>Courier details</b>
              <p>{[order.courierName, order.trackingNumber].filter(Boolean).join(' · ') || 'Saved on this order'}</p>
              {trackUrl && <a href={trackUrl} target="_blank" rel="noreferrer">Open tracking link</a>}
              <p className="muted">Change the status to Shipped if you need to edit these.</p>
            </div>
          ) : null}

          {error && <p className="status error">{error}</p>}
          {saved && <p className="note">Saved. The customer can open this order from their account to see the details.</p>}
          <button className="btn" disabled={busy} type="submit">{busy ? 'Saving…' : 'Update order'}</button>
        </form>
      </div>
      {order && <PrintSheet shop={shop} order={order} kind={printKind} />}
    </AdminShell>
  );
}
