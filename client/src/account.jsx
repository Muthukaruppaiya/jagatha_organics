import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { otpSentCopy, OrderPanel } from './checkout.jsx';
import { api, clearCustomer, forgetCustomer, inr, readCustomer, saveCustomer, sourceLabel, STATUS_LABEL, when } from './api.js';

function displayEmail(email) {
  const value = String(email || '');
  return value.endsWith('@phone.jagathaorganics.com') ? '' : value;
}

export function AccountLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(null);
  const [wait, setWait] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  useEffect(() => {
    api.accountMe()
      .then((me) => saveCustomer(me))
      .catch(() => forgetCustomer())
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <div className="wrap page narrow auth"><p className="muted">Opening your account…</p></div>;
  if (readCustomer()) return <Navigate to="/account" replace />;

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function sendCode() {
    const result = await api.registerStart(form);
    setSent(result);
    setCode('');
    setWait(30);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') {
        saveCustomer(await api.accountLogin(form.email, form.password));
        navigate('/account');
      } else if (!sent) {
        await sendCode();
      } else {
        saveCustomer(await api.registerVerify(sent.email, code));
        navigate('/account');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError('');
    try {
      await sendCode();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(mode === 'login' ? 'register' : 'login');
    setSent(null);
    setError('');
  }

  const verifying = mode === 'register' && sent;
  return (
    <div className="wrap page narrow auth">
      <h1>{mode === 'login' ? 'Sign in' : verifying ? 'Verify your email' : 'Create account'}</h1>
      <form className="glass form" onSubmit={submit}>
        {verifying ? (
          <>
            <p className="muted">Enter the 6-digit code we sent to {otpSentCopy(sent)}.</p>
            <p className="note">Check WhatsApp, your inbox, and spam. The same 6-digit code works in both places.</p>
            <input
              className="otp-input"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              aria-label="Verification code"
              autoFocus
              required
            />
            {error && <p className="status error">{error}</p>}
            <button className="btn" type="submit" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Verify and create account'}</button>
            <div className="otp-links">
              <button className="text-btn" type="button" onClick={resend} disabled={busy || wait > 0}>{wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}</button>
              <button className="text-btn" type="button" onClick={() => { setSent(null); setError(''); }}>Change email</button>
            </div>
          </>
        ) : (
          <>
            {mode === 'register' && (
              <>
                <label>Name<input value={form.name} onChange={(event) => set('name', event.target.value)} required autoComplete="name" /></label>
                <label>Mobile<input value={form.phone} onChange={(event) => set('phone', event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="tel" required autoComplete="tel-national" /></label>
              </>
            )}
            <label>Email<input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} required autoComplete="email" /></label>
            <label>Password<input type="password" value={form.password} onChange={(event) => set('password', event.target.value)} minLength={8} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
            {error && <p className="status error">{error}</p>}
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Send verification code'}</button>
          </>
        )}
        <button className="text" type="button" onClick={switchMode}>
          {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}

export function AccountHome() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(() => readCustomer());
  const [ready, setReady] = useState(Boolean(readCustomer()?.id));
  const customerKey = customer?.email || '';
  const [orders, setOrders] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [products, setProducts] = useState([]);
  const [slug, setSlug] = useState('');
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [openOrder, setOpenOrder] = useState('');

  useEffect(() => {
    let live = true;
    api.accountMe()
      .then((me) => {
        if (!live) return;
        saveCustomer(me);
        setCustomer(me);
        setReady(true);
      })
      .catch(() => {
        if (!live) return;
        forgetCustomer();
        setCustomer(null);
        setReady(true);
      });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const current = readCustomer();
    if (!current) return;
    let live = true;
    Promise.all([api.myOrders(), api.favorites(), api.myReviews(), api.products()])
      .then(([nextOrders, nextFavorites, nextReviews, nextProducts]) => {
        if (!live) return;
        setOrders(nextOrders);
        setFavorites(nextFavorites);
        setReviews(nextReviews);
        setProducts(nextProducts);
        setSlug(nextProducts[0]?.slug || '');
      })
      .catch((err) => {
        if (!live) return;
        if (/sign in/i.test(err.message)) {
          clearCustomer();
          navigate('/account/login');
        } else setError(err.message);
      });
    return () => { live = false; };
  }, [customerKey, navigate]);

  if (!ready) return <div className="wrap page"><p className="muted">Opening your account…</p></div>;
  if (!customer) return <Navigate to="/account/login" replace />;

  async function submitReview(event) {
    event.preventDefault();
    setError('');
    setSaved('');
    try {
      const review = await api.writeReview({ slug, rating, body });
      setReviews((current) => [review, ...current]);
      setBody('');
      setSaved('Sent to the kitchen. It appears on the product page after approval.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function unsave(item) {
    await api.removeFavorite(item.slug);
    setFavorites((current) => current.filter((favorite) => favorite.slug !== item.slug));
  }

  function logout() {
    clearCustomer();
    navigate('/');
  }

  const mail = displayEmail(customer.email);

  return (
    <div className="wrap page">
      <div className="page-intro">
        <p className="eyebrow">Account</p>
        <h1>{customer.name}</h1>
        <p>{[mail, customer.phone].filter(Boolean).join(' · ')}</p>
        <button className="text" type="button" onClick={logout}>Sign out</button>
      </div>
      {error && <p className="status error">{error}</p>}
      <div className="account-grid">
        <section className="glass summary account-orders">
          <h2>Last orders</h2>
          <p className="muted">Tap an order to see packing progress, courier details, and the delivery address.</p>
          {orders.length === 0 && <p className="muted">No orders yet. The shelf is open.</p>}
          {orders.map((order) => {
            const open = openOrder === order.orderNumber;
            return (
              <article key={order.orderNumber} className={open ? 'account-order open' : 'account-order'}>
                <button
                  className="account-order-head"
                  type="button"
                  onClick={() => setOpenOrder(open ? '' : order.orderNumber)}
                  aria-expanded={open}
                >
                  <span>
                    <b>{order.orderNumber}</b>
                    <small>{when(order.createdAt)} · {sourceLabel(order.channel)} · {inr(order.totalPaise)}</small>
                    <small>{order.items.map((item) => `${item.productName} · ${item.variantLabel} × ${item.quantity}`).join(', ')}</small>
                  </span>
                  <span className={`tag ${order.status}`}>{STATUS_LABEL[order.status]}</span>
                </button>
                {open && <OrderPanel order={order} />}
              </article>
            );
          })}
        </section>
        <section className="glass summary">
          <h2>Favourites</h2>
          {favorites.length === 0 && <p className="muted">Save a pack from its product page.</p>}
          {favorites.map((item) => (
            <p key={item.slug} className="fav-row">
              {item.image && <img src={item.image} alt="" />}
              <Link to={`/product/${item.slug}`}>{item.name}</Link>
              <button type="button" className="text" onClick={() => unsave(item)}>Remove</button>
            </p>
          ))}
          <details className="account-review">
            <summary>Write a review</summary>
            <form className="form" onSubmit={submitReview}>
              <label>Product
                <select value={slug} onChange={(event) => setSlug(event.target.value)}>
                  {products.map((product) => <option key={product.slug} value={product.slug}>{product.name}</option>)}
                </select>
              </label>
              <label>Rating
                <select value={rating} onChange={(event) => setRating(Number(event.target.value))}>
                  {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} star{value > 1 ? 's' : ''}</option>)}
                </select>
              </label>
              <label>Review<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} required minLength={8} /></label>
              {saved && <p className="note">{saved}</p>}
              <button className="btn" type="submit">Send for approval</button>
            </form>
          </details>
          {reviews.map((review) => (
            <p key={review.id}><b>{review.productName}</b> · {review.rating}/5 · {review.status === 'approved' ? 'On the site' : review.status === 'rejected' ? 'Not published' : 'Waiting for approval'}</p>
          ))}
        </section>
      </div>
    </div>
  );
}
