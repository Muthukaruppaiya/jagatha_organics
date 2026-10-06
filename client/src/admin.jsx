import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, NavLink, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, inr, PAYMENT_LABEL, readStaff, ROLE_LABEL, sourceLabel, STATUS_LABEL, whatsAppLink, when } from './api.js';

const STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];

function token() {
  return sessionStorage.getItem('jagatha-admin');
}

export function signedIn() {
  return Boolean(token() && readStaff()?.role);
}

function clearDesk() {
  sessionStorage.removeItem('jagatha-admin');
  sessionStorage.removeItem('jagatha-staff');
}

export function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (signedIn()) return <Navigate to="/admin" replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.login(email, password);
      sessionStorage.setItem('jagatha-admin', result.token);
      sessionStorage.setItem('jagatha-staff', JSON.stringify(result.staff));
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
  billing: 'M5 7h14v12H5zM5 11h14M8 15h3',
  inventory: 'M4 8l8-4 8 4-8 4zM4 12l8 4 8-4M4 16l8 4 8-4',
  images: 'M4 6h16v12H4zM8 14l2.5-3 2 2.2L16 9l4 5',
  reports: 'M5 19V9M12 19V5M19 19v-6',
  staff: 'M12 12a3.2 3.2 0 1 0-3.2-3.2A3.2 3.2 0 0 0 12 12zM6 19c.6-2.4 2.8-4 6-4s5.4 1.6 6 4',
  videos: 'M5 6h10v12H5zM15 10l5-2v8l-5-2z',
  reviews: 'M6 5h12v10H9l-3 3z',
};

const LINKS = [
  { to: '/admin', label: 'Orders', icon: 'orders', end: true, roles: ['admin', 'billing', 'delivery'] },
  { to: '/admin/billing', label: 'Store billing', icon: 'billing', roles: ['admin', 'billing'] },
  { to: '/admin/inventory', label: 'Inventory', icon: 'inventory', roles: ['admin', 'billing'] },
  { to: '/admin/images', label: 'Images', icon: 'images', roles: ['admin'] },
  { to: '/admin/videos', label: 'Videos', icon: 'videos', roles: ['admin'] },
  { to: '/admin/reviews', label: 'Reviews', icon: 'reviews', roles: ['admin', 'billing'] },
  { to: '/admin/reports', label: 'Reports', icon: 'reports', roles: ['admin', 'billing'] },
  { to: '/admin/staff', label: 'Staff', icon: 'staff', roles: ['admin'] },
];

export function AdminShell({ eyebrow, title, lead, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const person = readStaff();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  if (!signedIn()) {
    clearDesk();
    return <Navigate to="/admin/login" replace />;
  }
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
    if (!signedIn()) return;
    let live = true;
    Promise.all([api.summary(), api.orders({ status, q })])
      .then(([nextSummary, nextOrders]) => {
        if (!live) return;
        setSummary(nextSummary);
        setOrders(nextOrders);
      })
      .catch((err) => {
        if (!live) return;
        if (/sign in/i.test(err.message)) navigate('/admin/login');
        else setError(err.message);
      });
    return () => { live = false; };
  }, [status, q, navigate]);

  return (
    <AdminShell eyebrow="Desk" title="Orders" lead="Website, WhatsApp, and counter bills land here.">
      {summary && (
        <div className="desk-stats">
          <article><span>Open queue</span><strong>{summary.pending}</strong></article>
          <article><span>In progress</span><strong>{summary.open}</strong></article>
          <article><span>All orders</span><strong>{summary.total}</strong></article>
          <article><span>Active value</span><strong>{inr(summary.revenuePaise)}</strong></article>
        </div>
      )}
      <div className="desk-bar">
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name, phone, JO number" aria-label="Search orders" />
        <select value={status} aria-label="Filter by status" onChange={(event) => setStatus(event.target.value)}>
          <option value="">Every status</option>
          {STATUSES.map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}
        </select>
      </div>
      {error && <p className="status error">{error}</p>}
      <div className="order-board">
        {orders.length === 0 && <p className="empty desk-card">No orders in this view yet.</p>}
        {orders.map((order) => (
          <Link key={order.orderNumber} to={`/admin/orders/${order.orderNumber}`} className="order-card">
            <span className="avatar">{order.customerName.slice(0, 1)}</span>
            <div>
              <b>{order.orderNumber} · {order.customerName}</b>
              <small>{when(order.createdAt)} · {order.phone || 'No phone'} · {order.city}</small>
            </div>
            <span className={`chip ${order.channel || 'online'}`}>{sourceLabel(order.channel)}</span>
            <span className={`tag ${order.status}`}>{STATUS_LABEL[order.status]}</span>
            <strong>{inr(order.totalPaise)}</strong>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}

export function AdminOrder() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const person = readStaff();
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('pending');
  const [note, setNote] = useState('');
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const delivery = person?.role === 'delivery';
  const canCourier = person?.role === 'admin' || delivery;

  useEffect(() => {
    if (!signedIn()) return;
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
        if (/sign in/i.test(err.message)) navigate('/admin/login');
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
      if (canCourier) {
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

  if (!signedIn()) return <Navigate to="/admin/login" replace />;
  if (error && !order) {
    return (
      <AdminShell eyebrow="Order" title="Not found">
        <p className="status error">{error}</p>
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

  return (
    <AdminShell eyebrow={when(order.createdAt)} title={order.orderNumber}>
      <p className="tag-row"><span className={`tag ${order.status}`}>{STATUS_LABEL[order.status]}</span></p>
      <div className="split">
        <div className="glass summary">
          <h2>Packs</h2>
          <ul className="mini-lines">
            {order.items.map((item, index) => (
              <li key={`${item.productSlug}-${index}`}>
                {item.imageUrl && <img src={item.imageUrl} alt="" />}
                <span>{item.productName}<small>{item.variantLabel} × {item.quantity}</small></span>
                <b>{inr(item.unitPricePaise * item.quantity)}</b>
              </li>
            ))}
          </ul>
          <p className="total"><span>{PAYMENT_LABEL[order.paymentMethod] || 'Payment'}</span><b>{inr(order.totalPaise)}</b></p>
          <p className="muted">{sourceLabel(order.channel)} order</p>
          {order.phone && (
            <a className="btn wa" href={whatsAppLink(order.phone, `Hello ${order.customerName}, this is Jagatha Organics about order ${order.orderNumber}.`)} target="_blank" rel="noreferrer">Reply on WhatsApp</a>
          )}
          {order.notes && <p className="muted">Customer note: {order.notes}</p>}
        </div>
        <form className="glass form" onSubmit={save}>
          <h2>Customer</h2>
          <p className="who">
            <b>{order.customerName}</b>
            {order.phone && <a href={`tel:+91${order.phone}`}>{order.phone}</a>}
            {order.email && <a href={`mailto:${order.email}`}>{order.email}</a>}
          </p>
          <p>{order.addressLine}<br />{order.city} {order.pincode}</p>
          <label>Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}
            </select>
          </label>
          {!delivery && (
            <label>Desk note<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Called, will pack tomorrow…" /></label>
          )}
          {canCourier && (
            <>
              <label>Courier name<input value={courierName} onChange={(event) => setCourierName(event.target.value)} placeholder="Delhivery, DTDC, India Post" /></label>
              <label>Tracking number<input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="AWB or consignment number" /></label>
              <label>Tracking link<input value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} placeholder="https://" /></label>
              <p className="muted">The customer sees the courier name, number, and link on Track order.</p>
            </>
          )}
          {!canCourier && (order.courierName || order.trackingNumber) && (
            <p className="muted">Courier: {order.courierName || '—'} · {order.trackingNumber || 'No tracking number yet'}</p>
          )}
          {error && <p className="status error">{error}</p>}
          {saved && <p className="note">Saved. The customer can see this on Track order.</p>}
          <button className="btn" disabled={busy} type="submit">{busy ? 'Saving…' : 'Update order'}</button>
        </form>
      </div>
    </AdminShell>
  );
}
