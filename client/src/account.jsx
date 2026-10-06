import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, clearCustomer, inr, readCustomer, saveCustomer, sourceLabel, STATUS_LABEL, when } from './api.js';

export function AccountLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (readCustomer()) return <Navigate to="/account" replace />;

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = mode === 'login'
        ? await api.accountLogin(form.email, form.password)
        : await api.register(form);
      saveCustomer(result);
      navigate('/account');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap page narrow">
      <p className="eyebrow">Your account</p>
      <h1>{mode === 'login' ? 'Sign in' : 'Create an account'}</h1>
      <p className="lead">See your orders, save favourite packs, and write a review for the kitchen to approve.</p>
      <form className="glass form" onSubmit={submit}>
        {mode === 'register' && (
          <>
            <label>Name<input value={form.name} onChange={(event) => set('name', event.target.value)} required /></label>
            <label>Mobile<input value={form.phone} onChange={(event) => set('phone', event.target.value)} inputMode="tel" required /></label>
          </>
        )}
        <label>Email<input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} required /></label>
        <label>Password<input type="password" value={form.password} onChange={(event) => set('password', event.target.value)} minLength={8} required /></label>
        {error && <p className="status error">{error}</p>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button className="text" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}

export function AccountHome() {
  const navigate = useNavigate();
  const customer = readCustomer();
  const [orders, setOrders] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [products, setProducts] = useState([]);
  const [slug, setSlug] = useState('');
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (!customer) return;
    Promise.all([api.myOrders(), api.favorites(), api.myReviews(), api.products()])
      .then(([nextOrders, nextFavorites, nextReviews, nextProducts]) => {
        setOrders(nextOrders);
        setFavorites(nextFavorites);
        setReviews(nextReviews);
        setProducts(nextProducts);
        setSlug(nextProducts[0]?.slug || '');
      })
      .catch((err) => {
        if (/sign in/i.test(err.message)) {
          clearCustomer();
          navigate('/account/login');
        } else setError(err.message);
      });
  }, [customer, navigate]);

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

  return (
    <div className="wrap page">
      <div className="page-intro">
        <p className="eyebrow">Account</p>
        <h1>{customer.name}</h1>
        <p>{customer.email}{customer.phone ? ` · ${customer.phone}` : ''}</p>
        <button className="text" type="button" onClick={logout}>Sign out</button>
      </div>
      {error && <p className="status error">{error}</p>}
      <div className="account-grid">
        <section className="glass summary">
          <h2>Last orders</h2>
          {orders.length === 0 && <p className="muted">No orders yet. The shelf is open.</p>}
          {orders.map((order) => (
            <article key={order.orderNumber} className="account-order">
              <p><b>{order.orderNumber}</b> <span className={`tag ${order.status}`}>{STATUS_LABEL[order.status]}</span></p>
              <p className="muted">{when(order.createdAt)} · {sourceLabel(order.channel)} · {inr(order.totalPaise)}</p>
              <ul>
                {order.items.map((item, index) => (
                  <li key={`${item.productName}-${index}`}>{item.productName} · {item.variantLabel} × {item.quantity}</li>
                ))}
              </ul>
              {order.courierName && <p className="muted">Courier {order.courierName} {order.trackingNumber}</p>}
              <Link to="/track">Track</Link>
            </article>
          ))}
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
          <h2>Write a review</h2>
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
          {reviews.map((review) => (
            <p key={review.id}><b>{review.productName}</b> · {review.rating}/5 · {review.status === 'approved' ? 'On the site' : review.status === 'rejected' ? 'Not published' : 'Waiting for approval'}</p>
          ))}
        </section>
      </div>
    </div>
  );
}
