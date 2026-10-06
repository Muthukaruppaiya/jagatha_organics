import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, inr, orderWhatsAppText, PAYMENT_LABEL, readCustomer, STATUS_LABEL, whatsAppLink, when } from './api.js';
import { useCart } from './cart.jsx';
import { ReelStage } from './reels.jsx';

function useCatalog() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    Promise.all([api.products(), api.categories()])
      .then(([nextProducts, nextCategories]) => {
        if (!live) return;
        setProducts(nextProducts);
        setCategories(nextCategories);
      })
      .catch((err) => live && setError(err.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  return { products, categories, error, loading };
}

export function ProductCard({ product }) {
  const off = product.fromComparePaise > product.fromPricePaise
    ? Math.round((1 - product.fromPricePaise / product.fromComparePaise) * 100)
    : 0;
  return (
    <Link to={`/product/${product.slug}`} className="card">
      <span className="card-media">
        <img src={product.images[0]} alt="" />
        {off > 0 && <span className="pill">Sale · {off}%</span>}
      </span>
      <span className="card-body">
        <span className="eyebrow">{product.category.name}</span>
        <h3>{product.name}</h3>
        <span className="card-foot">
          <span className="price">
            <strong>{inr(product.fromPricePaise)}</strong>
            {off > 0 && <s>{inr(product.fromComparePaise)}</s>}
          </span>
          <span className="card-go" aria-hidden="true">→</span>
        </span>
        <span className="weights">
          {product.variants.map((variant) => <em key={variant.label}>{variant.label}</em>)}
        </span>
      </span>
    </Link>
  );
}

function Shelf({ title, products, more }) {
  if (!products.length) return null;
  return (
    <section className="wrap section">
      <div className="section-head">
        <h2>{title}</h2>
        {more && <Link to={more}>View all</Link>}
      </div>
      <div className="grid">
        {products.map((product) => <ProductCard key={product.slug} product={product} />)}
      </div>
    </section>
  );
}

export function Home() {
  const { products, categories, error, loading } = useCatalog();
  const featured = products.filter((product) => product.featured).slice(0, 8);
  const laddus = products.filter((product) => product.category.slug === 'laddu').slice(0, 4);
  const gifts = products.filter((product) => product.category.slug === 'gift-boxes').slice(0, 4);

  return (
    <>
      <section className="wrap hero">
        <div className="hero-copy glass">
          <p className="eyebrow">Pallikaranai · Chennai</p>
          <h1>Traditional sweets, packed for this week.</h1>
          <p>Millet laddus, no-sugar bars, murukku, and gift boxes from Jagatha Organics. Choose a pack size, place the order, and the kitchen confirms it on your phone.</p>
          <div className="actions">
            <Link className="btn" to="/shop">Shop the shelf</Link>
            <Link className="btn ghost" to="/shop/gift-boxes">Gift boxes</Link>
          </div>
          <ul className="trust">
            <li>Small batches</li>
            <li>Weight packs</li>
            <li>Cash on delivery</li>
          </ul>
        </div>
        <ReelStage />
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {['Laddu', 'No sugar', 'Millet snacks', 'Gift boxes', 'Protein bars', 'Cash on delivery', 'Pallikaranai'].concat(['Laddu', 'No sugar', 'Millet snacks', 'Gift boxes', 'Protein bars', 'Cash on delivery', 'Pallikaranai']).map((word, index) => (
            <span key={`${word}-${index}`}>{word}</span>
          ))}
        </div>
      </div>

      <section className="wrap cats">
        {(categories.length ? categories : [
          { slug: 'laddu', name: 'Laddu', blurb: 'Nut and millet laddus' },
          { slug: 'no-sugar-no-jaggery', name: 'No Sugar No Jaggery', blurb: 'Bars without sugar' },
          { slug: 'energy-delight', name: 'Energy Delight', blurb: 'Herb and millet bites' },
          { slug: 'snacks', name: 'Snacks', blurb: 'Murukku, sev, malt' },
          { slug: 'gift-boxes', name: 'Gift Boxes', blurb: 'Assorted boxes' },
        ]).map((category) => {
          const photo = products.find((product) => product.category.slug === category.slug)?.images[0];
          return (
            <Link key={category.slug} to={`/shop/${category.slug}`} className="cat glass">
              {photo && <img src={photo} alt="" />}
              <span>
                <b>{category.name}</b>
                <small>{category.blurb}</small>
              </span>
            </Link>
          );
        })}
      </section>

      {loading && <p className="wrap status">Loading the shelf…</p>}
      {error && <p className="wrap status error">{error}</p>}
      {featured[0] && (
        <Link className="spotlight" to={`/product/${featured[0].slug}`}>
          <img src={featured[0].images[0]} alt="" />
          <div>
            <p className="eyebrow">{featured[0].category.name}</p>
            <h2>{featured[0].name}</h2>
            <p>{featured[0].description}</p>
            <strong>{inr(featured[0].fromPricePaise)}</strong>
            <span className="btn">View this pack</span>
          </div>
        </Link>
      )}
      <Shelf title="On the counter" products={featured.slice(1)} more="/shop" />
      <section className="wrap story">
        <img src="/media/snacks/mappillai-samba-murukku-2-1.png" alt="Mappillai Samba rice murukku" />
        <div>
          <p className="eyebrow">The kitchen</p>
          <h2>Made in Chennai, sold by the pack.</h2>
          <p>Jagatha Organics keeps a short shelf: laddus, seed and herb bars, traditional rice snacks, and mixed gift boxes. The no-sugar range is made without sugar or jaggery. Orders are packed from Pallikaranai and confirmed by phone.</p>
        </div>
      </section>
      <Shelf title="Laddu" products={laddus} more="/shop/laddu" />
      <Shelf title="Gift boxes" products={gifts} more="/shop/gift-boxes" />
    </>
  );
}

export function Shop() {
  const { category } = useParams();
  const [params, setParams] = useSearchParams();
  const { products, categories, error, loading } = useCatalog();
  const query = params.get('q') || '';
  const sort = params.get('sort') || 'featured';

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = products.filter((product) => {
      const inCategory = !category || product.category.slug === category;
      const matches = !needle || `${product.name} ${product.description} ${product.category.name}`.toLowerCase().includes(needle);
      return inCategory && matches;
    });
    if (sort === 'featured') list = [...list].sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.fromPricePaise - b.fromPricePaise);
    if (sort === 'price-desc') list = [...list].sort((a, b) => b.fromPricePaise - a.fromPricePaise);
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [products, category, query, sort]);

  const current = categories.find((item) => item.slug === category);

  function update(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  return (
    <div className="wrap page">
      <div className="page-intro">
        <p className="eyebrow">{current ? 'Category' : 'The full shelf'}</p>
        <h1>{current ? current.name : 'Shop'}</h1>
        <p>{current?.blurb || 'Laddus, bars, snacks, and gift boxes. Every item is sold by weight.'}</p>
      </div>
      <div className="filters glass">
        <div className="chips">
          <Link className={!category ? 'chip on' : 'chip'} to={`/shop${params.toString() ? `?${params}` : ''}`}>All</Link>
          {categories.map((item) => (
            <Link key={item.slug} className={category === item.slug ? 'chip on' : 'chip'} to={`/shop/${item.slug}${params.toString() ? `?${params}` : ''}`}>
              {item.name}
            </Link>
          ))}
        </div>
        <div className="filter-tools">
          <input
            value={query}
            onChange={(event) => update('q', event.target.value)}
            placeholder="Search peanut, murukku, malt…"
            aria-label="Search products"
          />
          <select value={sort} aria-label="Sort products" onChange={(event) => update('sort', event.target.value === 'featured' ? '' : event.target.value)}>
            <option value="featured">Featured</option>
            <option value="price-asc">Price, low to high</option>
            <option value="price-desc">Price, high to low</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>
      {loading && <p className="status">Loading the shelf…</p>}
      {error && <p className="status error">{error}</p>}
      {!loading && visible.length === 0 && <p className="status">Nothing matches that search.</p>}
      <div className="grid">
        {visible.map((product) => <ProductCard key={product.slug} product={product} />)}
      </div>
    </div>
  );
}

export function Product() {
  const { slug } = useParams();
  const cart = useCart();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [image, setImage] = useState(0);
  const [variantId, setVariantId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reviews, setReviews] = useState({ average: 0, count: 0, reviews: [] });
  const [reviewBody, setReviewBody] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewNote, setReviewNote] = useState('');
  const customer = readCustomer();

  useEffect(() => {
    let live = true;
    setProduct(null);
    setError('');
    setAdded(false);
    api.product(slug)
      .then((next) => {
        if (!live) return;
        setProduct(next);
        setImage(0);
        setVariantId(next.variants[0]?.id || null);
        setQuantity(1);
      })
      .catch((err) => live && setError(err.message));
    api.productReviews(slug).then((next) => live && setReviews(next)).catch(() => {});
    if (readCustomer()) {
      api.favorites().then((list) => live && setSaved(list.some((item) => item.slug === slug))).catch(() => {});
    } else setSaved(false);
    return () => { live = false; };
  }, [slug]);

  if (error) return <p className="wrap status error">{error}</p>;
  if (!product) return <p className="wrap status">Loading…</p>;

  const variant = product.variants.find((item) => item.id === variantId) || product.variants[0];
  const left = Number.isInteger(variant?.stockQty) ? variant.stockQty : null;
  const out = left === 0;

  function add() {
    cart.add({
      variantId: variant.id,
      quantity,
      name: product.name,
      label: variant.label,
      pricePaise: variant.pricePaise,
      image: product.images[0],
      slug: product.slug,
    });
    setAdded(true);
  }

  async function toggleFavorite() {
    if (!customer) return;
    if (saved) {
      await api.removeFavorite(product.slug);
      setSaved(false);
    } else {
      await api.saveFavorite(product.slug);
      setSaved(true);
    }
  }

  async function sendReview(event) {
    event.preventDefault();
    setReviewNote('');
    try {
      await api.writeReview({ slug: product.slug, rating: reviewRating, body: reviewBody });
      setReviewBody('');
      setReviewNote('Sent. It shows here after the kitchen approves it.');
    } catch (err) {
      setReviewNote(err.message);
    }
  }

  return (
    <>
    <div className="wrap product">
      <div className="gallery">
        <div className="glass stage">
          <img src={product.images[image] || product.images[0]} alt={product.name} />
        </div>
        {product.images.length > 1 && (
          <div className="thumbs">
            {product.images.map((src, index) => (
              <button key={src} type="button" className={index === image ? 'on' : ''} onClick={() => setImage(index)}>
                <img src={src} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="buy glass">
        <p className="eyebrow"><Link to={`/shop/${product.category.slug}`}>{product.category.name}</Link></p>
        <h1>{product.name}</h1>
        <p className="lead">{product.description}</p>
        <p className="price big">
          <strong>{inr(variant.pricePaise)}</strong>
          {variant.comparePaise > variant.pricePaise && <s>{inr(variant.comparePaise)}</s>}
        </p>
        <fieldset>
          <legend>Pack</legend>
          <div className="packs">
            {product.variants.map((item) => (
              <button key={item.id} type="button" className={item.id === variant.id ? 'pack on' : 'pack'} onClick={() => { setVariantId(item.id); setAdded(false); }}>
                <b>{item.label}</b>
                <span>{inr(item.pricePaise)}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="buy-row">
          <div className="stepper" aria-label="Quantity">
            <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity">−</button>
            <span>{quantity}</span>
            <button type="button" onClick={() => setQuantity((value) => Math.min(20, left == null ? value + 1 : Math.min(left, value + 1)))} aria-label="Increase quantity">+</button>
          </div>
          <button className="btn" type="button" onClick={add} disabled={out || (left != null && quantity > left)}>{out ? 'Out of stock' : added ? 'Added' : 'Add to cart'}</button>
          {customer ? (
            <button className="btn ghost" type="button" onClick={toggleFavorite}>{saved ? 'Saved' : 'Save'}</button>
          ) : (
            <Link className="btn ghost" to="/account/login">Save</Link>
          )}
        </div>
        <p className={out ? 'status error' : 'muted'}>{out ? 'This pack is out of stock.' : left != null && left <= 8 ? `Only ${left} left in this pack.` : 'In stock.'}</p>
        {added && <p className="note">In the cart. <Link to="/cart">Review order</Link></p>}
        <p className="muted">Cash on delivery. The team calls {` `}<a href="tel:+919884126032">+91 98841 26032</a> to confirm packing from Pallikaranai.</p>
      </div>
    </div>
    <section className="wrap section reviews">
      <div className="section-head">
        <h2>Reviews</h2>
        <span>{reviews.count ? `${reviews.average} / 5 · ${reviews.count}` : 'No published reviews yet'}</span>
      </div>
      {reviews.reviews.map((review, index) => (
        <article key={`${review.name}-${index}`} className="glass review-card">
          <b>{review.name}</b>
          <span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
          <p>{review.body}</p>
        </article>
      ))}
      {customer ? (
        <form className="glass form" onSubmit={sendReview}>
          <h3>Write a review</h3>
          <label>Rating
            <select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}>
              {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Your note<textarea value={reviewBody} onChange={(event) => setReviewBody(event.target.value)} rows={3} minLength={8} required /></label>
          {reviewNote && <p className="note">{reviewNote}</p>}
          <button className="btn" type="submit">Send for approval</button>
        </form>
      ) : (
        <p className="muted"><Link to="/account/login">Sign in</Link> to write a review. The kitchen approves it before it appears here.</p>
      )}
    </section>
    </>
  );
}

export function Cart() {
  const cart = useCart();
  if (cart.items.length === 0) {
    return (
      <div className="wrap page narrow">
        <h1>Cart</h1>
        <p className="lead">The cart is empty.</p>
        <Link className="btn" to="/shop">Browse the shelf</Link>
      </div>
    );
  }
  return (
    <div className="wrap page">
      <h1>Cart</h1>
      <div className="split">
        <ul className="lines">
          {cart.items.map((item) => (
            <li key={item.variantId} className="glass line">
              <img src={item.image} alt="" />
              <div>
                <h2><Link to={`/product/${item.slug}`}>{item.name}</Link></h2>
                <p className="muted">{item.label}</p>
                <button type="button" className="text" onClick={() => cart.remove(item.variantId)}>Remove</button>
              </div>
              <div className="line-end">
                <div className="stepper">
                  <button type="button" onClick={() => cart.setQty(item.variantId, item.quantity - 1)} aria-label="Decrease quantity">−</button>
                  <span>{item.quantity}</span>
                  <button type="button" onClick={() => cart.setQty(item.variantId, item.quantity + 1)} aria-label="Increase quantity">+</button>
                </div>
                <strong>{inr(item.pricePaise * item.quantity)}</strong>
              </div>
            </li>
          ))}
        </ul>
        <aside className="glass summary">
          <h2>Order</h2>
          <p><span>Items</span><b>{cart.count}</b></p>
          <p><span>To pay</span><b>{inr(cart.totalPaise)}</b></p>
          <p className="muted">Cash on delivery, or send the same cart as a WhatsApp order. Jagatha confirms either one from the desk.</p>
          <Link className="btn" to="/checkout">Checkout</Link>
          <Link className="btn wa" to="/checkout">Order on WhatsApp</Link>
        </aside>
      </div>
    </div>
  );
}

export function Checkout() {
  const cart = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    email: '',
    addressLine: '',
    city: 'Chennai',
    pincode: '',
    notes: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [via, setVia] = useState('');

  if (cart.items.length === 0) {
    return (
      <div className="wrap page narrow">
        <h1>Checkout</h1>
        <p>Add something from the shelf first.</p>
        <Link className="btn" to="/shop">Shop</Link>
      </div>
    );
  }

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function place(nextVia) {
    setBusy(true);
    setVia(nextVia);
    setError('');
    try {
      const order = await api.createOrder({
        ...form,
        via: nextVia,
        items: cart.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
      });
      cart.clear();
      if (nextVia === 'whatsapp') window.open(whatsAppLink('', orderWhatsAppText(order)), '_blank', 'noopener,noreferrer');
      navigate(`/order/${order.orderNumber}`, { state: order });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setVia('');
    }
  }

  function submit(event) {
    event.preventDefault();
    place('cod');
  }

  function sendWhatsApp(event) {
    const formEl = event.currentTarget.form;
    if (!formEl.reportValidity()) return;
    place('whatsapp');
  }

  return (
    <div className="wrap page">
      <h1>Checkout</h1>
      <form className="split" onSubmit={submit}>
        <div className="glass form">
          <label>Full name<input value={form.customerName} onChange={(event) => set('customerName', event.target.value)} required autoComplete="name" /></label>
          <label>Mobile<input value={form.phone} onChange={(event) => set('phone', event.target.value)} required inputMode="tel" autoComplete="tel" placeholder="10-digit number" /></label>
          <label>Email <span>optional</span><input value={form.email} onChange={(event) => set('email', event.target.value)} type="email" autoComplete="email" /></label>
          <label>Address<textarea value={form.addressLine} onChange={(event) => set('addressLine', event.target.value)} required rows={3} autoComplete="street-address" /></label>
          <div className="two">
            <label>City<input value={form.city} onChange={(event) => set('city', event.target.value)} required autoComplete="address-level2" /></label>
            <label>PIN code<input value={form.pincode} onChange={(event) => set('pincode', event.target.value)} required inputMode="numeric" autoComplete="postal-code" /></label>
          </div>
          <label>Note for the kitchen <span>optional</span><textarea value={form.notes} onChange={(event) => set('notes', event.target.value)} rows={2} /></label>
          <div className="pay-choices">
            <div className="pay glass">
              <b>Cash on delivery</b>
              <span>Pay when the pack arrives.</span>
            </div>
            <div className="pay glass wa-pay">
              <b>WhatsApp order</b>
              <span>Same details, sent to Jagatha on WhatsApp and saved in the order desk.</span>
            </div>
          </div>
          {error && <p className="status error">{error}</p>}
          <div className="actions">
            <button className="btn" type="submit" disabled={busy}>{busy && via === 'cod' ? 'Placing order…' : `Place order · ${inr(cart.totalPaise)}`}</button>
            <button className="btn wa" type="button" onClick={sendWhatsApp} disabled={busy}>{busy && via === 'whatsapp' ? 'Opening WhatsApp…' : 'Order on WhatsApp'}</button>
          </div>
        </div>
        <aside className="glass summary">
          <h2>Your packs</h2>
          {cart.items.map((item) => (
            <p key={item.variantId}><span>{item.name} · {item.label} × {item.quantity}</span><b>{inr(item.pricePaise * item.quantity)}</b></p>
          ))}
          <p className="total"><span>To pay</span><b>{inr(cart.totalPaise)}</b></p>
        </aside>
      </form>
    </div>
  );
}

export function OrderDone() {
  const { orderNumber } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    const placed = location.state?.orderNumber === orderNumber ? location.state : null;
    if (placed) {
      sessionStorage.setItem(`order-${orderNumber}`, JSON.stringify(placed));
      setOrder(placed);
      return;
    }
    const saved = sessionStorage.getItem(`order-${orderNumber}`);
    if (saved) setOrder(JSON.parse(saved));
  }, [location.state, orderNumber]);

  return (
    <div className="wrap page narrow">
      <p className="eyebrow">Order placed</p>
      <h1>{orderNumber}</h1>
      <p className="lead">{order?.paymentMethod === 'whatsapp' ? 'The order is on the desk, and WhatsApp should have opened with the details. If it did not, use the button below.' : 'We have the order. Jagatha will confirm it on the mobile number you entered. Payment is cash on delivery.'}</p>
      {order && (
        <div className="glass summary">
          <p><span>Status</span><b className={`tag ${order.status}`}>{STATUS_LABEL[order.status] || order.status}</b></p>
          <p><span>Total</span><b>{inr(order.totalPaise)}</b></p>
          <p><span>Deliver to</span><b>{order.customerName}, {order.city}</b></p>
        </div>
      )}
      <div className="actions">
        {order?.paymentMethod === 'whatsapp' && <a className="btn wa" href={whatsAppLink('', orderWhatsAppText(order))} target="_blank" rel="noreferrer">Open WhatsApp</a>}
        <Link className="btn" to="/track">Track this order</Link>
        <Link className="btn ghost" to="/shop">Keep shopping</Link>
      </div>
    </div>
  );
}

export function Track() {
  const [number, setNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setOrder(null);
    try {
      setOrder(await api.track(number, phone));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap page narrow">
      <p className="eyebrow">Orders</p>
      <h1>Track an order</h1>
      <p className="lead">Use the order number from checkout and the same mobile number.</p>
      <form className="glass form" onSubmit={submit}>
        <label>Order number<input value={number} onChange={(event) => setNumber(event.target.value)} placeholder="JO1001" required /></label>
        <label>Mobile<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" required /></label>
        {error && <p className="status error">{error}</p>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Looking…' : 'Find order'}</button>
      </form>
      {order && <OrderPanel order={order} />}
    </div>
  );
}

export function OrderPanel({ order }) {
  return (
    <article className="glass summary order-panel">
      <p><span>Order</span><b>{order.orderNumber}</b></p>
      <p><span>Status</span><b className={`tag ${order.status}`}>{STATUS_LABEL[order.status]}</b></p>
      <p><span>Placed</span><b>{when(order.createdAt)}</b></p>
      <p><span>Payment</span><b>{PAYMENT_LABEL[order.paymentMethod] || 'Cash on delivery'}</b></p>
      {order.channel === 'store' && <p><span>Channel</span><b>Store counter</b></p>}
      {(order.courierName || order.trackingNumber) && (
        <>
          {order.courierName && <p><span>Courier</span><b>{order.courierName}</b></p>}
          {order.trackingNumber && <p><span>Tracking number</span><b>{order.trackingNumber}</b></p>}
          {/^https?:\/\//i.test(order.trackingUrl || '') && (
            <p><a href={order.trackingUrl} target="_blank" rel="noreferrer">Open courier tracking</a></p>
          )}
        </>
      )}
      <ul className="mini-lines">
        {order.items.map((item, index) => (
          <li key={`${item.productSlug}-${index}`}>
            {item.imageUrl && <img src={item.imageUrl} alt="" />}
            <span>{item.productName}<small>{item.variantLabel} × {item.quantity}</small></span>
            <b>{inr(item.unitPricePaise * item.quantity)}</b>
          </li>
        ))}
      </ul>
      <p className="total"><span>Total</span><b>{inr(order.totalPaise)}</b></p>
      <p className="muted">{order.addressLine}, {order.city} {order.pincode}</p>
    </article>
  );
}

export function Contact() {
  return (
    <div className="wrap page contact">
      <div>
        <p className="eyebrow">Pallikaranai</p>
        <h1>Talk to the kitchen.</h1>
        <p className="lead">Questions about a pack, a gift box, or an order already placed — call or write. The shop confirms delivery after the order comes in.</p>
      </div>
      <div className="glass form contact-card">
        <p><span>Phone</span><a href="tel:+919884126032">+91 98841 26032</a></p>
        <p><span>WhatsApp</span><a href="https://wa.me/919884126032" target="_blank" rel="noreferrer">Message Jagatha</a></p>
        <p><span>Email</span><a href="mailto:jagathaorganics@gmail.com">jagathaorganics@gmail.com</a></p>
        <p><span>Studio</span><b>Pallikaranai, Chennai, Tamil Nadu 600100</b></p>
        <p><span>Instagram</span><a href="https://www.instagram.com/jagathaorganics/" target="_blank" rel="noreferrer">@jagathaorganics</a></p>
      </div>
    </div>
  );
}

export function Missing() {
  return (
    <div className="wrap page narrow">
      <h1>That page is not on the shelf.</h1>
      <Link className="btn" to="/">Back home</Link>
    </div>
  );
}
