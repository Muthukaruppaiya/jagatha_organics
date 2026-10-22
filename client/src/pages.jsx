import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, inr, lookupPincode, readCustomer } from './api.js';
import { useCart } from './cart.jsx';
import { HeroBanner } from './banner.jsx';
import { PriceDetails } from './checkout.jsx';

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
        setProducts(Array.isArray(nextProducts) ? nextProducts : []);
        setCategories(Array.isArray(nextCategories) ? nextCategories : []);
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
        <h3>{product.name}</h3>
        <span className="card-foot">
          <span className="price">
            <strong>{inr(product.fromPricePaise)}</strong>
            {off > 0 && <s>{inr(product.fromComparePaise)}</s>}
          </span>
          <span className="card-go" aria-hidden="true">→</span>
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
  const shelves = categories.filter((category) => category.count !== 0);

  return (
    <>
      <HeroBanner />

      <section className="wrap cats">
        {shelves.map((category) => {
          const inCategory = products.filter((product) => product.category.slug === category.slug);
          const photo = (inCategory.find((product) => !product.images[0].includes('placeholder')) || inCategory[0])?.images[0];
          return (
            <Link key={category.slug} to={`/shop/${category.slug}`} className="cat glass">
              {photo && <img src={photo} alt="" />}
              <b>{category.name}</b>
            </Link>
          );
        })}
      </section>

      {loading && <p className="wrap status">Loading…</p>}
      {error && <p className="wrap status error">{error}</p>}
      <Shelf title="Products" products={featured} more="/shop" />

      <section className="wrap section about glass">
        <img src="/media/laddu/navadhanya-laddu-2-1.jpg" alt="Navadhanya laddu" />
        <div>
          <p className="eyebrow">About us</p>
          <h2>Jagatha Organics</h2>
          <p>Healthy laddus, protein bars, snacks, health mixes, and malts, made in Pallikaranai, Chennai. Our no-sugar range is made without sugar or jaggery.</p>
          <Link className="btn ghost" to="/contact">Contact us</Link>
        </div>
      </section>
    </>
  );
}

export function Shop() {
  const { category } = useParams();
  const [params, setParams] = useSearchParams();
  const { products, categories, error, loading } = useCatalog();
  const chipsRef = useRef(null);
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

  useEffect(() => {
    const strip = chipsRef.current;
    const on = strip?.querySelector('.on');
    if (!strip || !on) return;
    strip.scrollTo({ left: on.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2, behavior: 'smooth' });
  }, [category, categories]);

  function update(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  return (
    <div className="wrap page">
      <div className="page-intro shop-head">
        <h1>{current ? current.name : query ? `“${query}”` : 'Shop'}</h1>
        {!loading && <span>{visible.length} product{visible.length === 1 ? '' : 's'}</span>}
      </div>
      <div className="shop-filters">
        <nav className="cat-chips" ref={chipsRef} aria-label="Categories">
          <Link className={!category ? 'cat-chip on' : 'cat-chip'} to={`/shop${params.toString() ? `?${params}` : ''}`}>All</Link>
          {categories.filter((item) => item.count !== 0).map((item) => (
            <Link key={item.slug} className={category === item.slug ? 'cat-chip on' : 'cat-chip'} to={`/shop/${item.slug}${params.toString() ? `?${params}` : ''}`}>
              {item.name}
              {item.count ? <small>{item.count}</small> : null}
            </Link>
          ))}
        </nav>
        <div className="shop-tools">
          <label className="shop-search">
            <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" /></svg>
            <input
              value={query}
              onChange={(event) => update('q', event.target.value)}
              placeholder="Search products"
              aria-label="Search products"
              enterKeyHint="search"
            />
            {query && <button type="button" aria-label="Clear search" onClick={() => update('q', '')}>×</button>}
          </label>
          <label className="shop-sort">
            <select value={sort} aria-label="Sort products" onChange={(event) => update('sort', event.target.value === 'featured' ? '' : event.target.value)}>
              <option value="featured">Featured</option>
              <option value="price-asc">Price: low</option>
              <option value="price-desc">Price: high</option>
              <option value="name">A–Z</option>
            </select>
          </label>
        </div>
      </div>
      {loading && <p className="status">Loading…</p>}
      {error && <p className="status error">{error}</p>}
      {!loading && visible.length === 0 && <p className="status">No products found.</p>}
      <div className="grid">
        {visible.map((product) => <ProductCard key={product.slug} product={product} />)}
      </div>
    </div>
  );
}

export function Product() {
  const { slug } = useParams();
  const cart = useCart();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [image, setImage] = useState(0);
  const [variantId, setVariantId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [cartNote, setCartNote] = useState('');
  const [reviews, setReviews] = useState({ average: 0, count: 0, reviews: [] });
  const [reviewBody, setReviewBody] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewNote, setReviewNote] = useState('');
  const [related, setRelated] = useState([]);
  const customer = readCustomer();

  useEffect(() => {
    let live = true;
    setProduct(null);
    setError('');
    setAdded(false);
    setCartNote('');
    setRelated([]);
    api.products()
      .then((list) => {
        if (!live) return;
        const self = list.find((item) => item.slug === slug);
        const others = list.filter((item) => item.slug !== slug);
        const sameCategory = others.filter((item) => item.category.slug === self?.category.slug);
        const bestsellers = others.filter((item) => item.featured && !sameCategory.includes(item));
        setRelated([...sameCategory, ...bestsellers].slice(0, 4));
      })
      .catch(() => {});
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
    return () => { live = false; };
  }, [slug]);

  if (error) return <p className="wrap status error">{error}</p>;
  if (!product) return <p className="wrap status">Loading…</p>;

  const variant = product.variants.find((item) => item.id === variantId) || product.variants[0];
  const left = Number.isInteger(variant?.stockQty) ? variant.stockQty : null;
  const out = left === 0;

  function liveVariant() {
    return Number.isInteger(Number(variant.id)) && String(Number(variant.id)) === String(variant.id);
  }

  function cartLine() {
    return {
      variantId: variant.id,
      quantity,
      name: product.name,
      label: variant.label,
      pricePaise: variant.pricePaise,
      comparePaise: variant.comparePaise,
      image: product.images[0],
      slug: product.slug,
      stockQty: left,
      grams: variant.weightGrams,
    };
  }

  function add() {
    if (!liveVariant()) {
      setAdded(false);
      setCartNote('The shop server is offline, so packs cannot be added to the cart right now.');
      return;
    }
    if (!cart.items.some((item) => item.variantId === variant.id)) {
      cart.add(cartLine());
    } else {
      cart.setQty(variant.id, cart.items.find((item) => item.variantId === variant.id).quantity + quantity);
    }
    setCartNote('');
    setAdded(true);
  }

  function buyNow() {
    if (!liveVariant()) {
      setAdded(false);
      setCartNote('The shop server is offline, so packs cannot be added to the cart right now.');
      return;
    }
    if (!cart.items.some((item) => item.variantId === variant.id)) {
      cart.add(cartLine());
    }
    navigate('/checkout');
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
          <button className="btn ghost" type="button" onClick={add} disabled={out || (left != null && quantity > left)}>{out ? 'Out of stock' : added ? 'Added' : 'Add to cart'}</button>
          <button className="btn buy-now" type="button" onClick={buyNow} disabled={out || (left != null && quantity > left)}>Buy now</button>
        </div>
        {!out && left != null && left <= 8 && <p className="muted">Only {left} left</p>}
        {cartNote && <p className="status error">{cartNote}</p>}
        {added && <p className="note">Added. <Link to="/cart">View cart</Link></p>}
      </div>
    </div>
    <Shelf title="You may also like" products={related} more={`/shop/${product.category.slug}`} />
    <section className="wrap section reviews">
      <div className="section-head">
        <h2>Reviews</h2>
        <span>{reviews.count ? `${reviews.average} / 5 · ${reviews.count}` : 'No reviews yet'}</span>
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
        <p className="muted"><Link to="/account/login">Sign in</Link> to write a review.</p>
      )}
    </section>
    </>
  );
}

export function Cart() {
  const cart = useCart();
  const [pincode, setPincode] = useState('');
  const [state, setState] = useState('');
  function onPincode(value) {
    setPincode(value);
    if (value.length === 6) {
      lookupPincode(value).then((found) => setState(found?.state || ''));
    } else {
      setState('');
    }
  }
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
        <PriceDetails items={cart.items} pincode={pincode} state={state} onPincode={onPincode}>
          <Link className="btn step-cta wide" to="/checkout">Place order</Link>
        </PriceDetails>
      </div>
    </div>
  );
}

export function Contact() {
  return (
    <div className="wrap page contact">
      <div>
        <h1>Contact</h1>
      </div>
      <div className="glass form contact-card">
        <p><span>Phone</span><a href="tel:+919884126032">+91 98841 26032</a></p>
        <p><span>WhatsApp</span><a href="https://wa.me/919884126032" target="_blank" rel="noreferrer">Message Jagatha</a></p>
        <p><span>Email</span><a href="mailto:jagathaorganics@gmail.com">jagathaorganics@gmail.com</a></p>
        <p><span>Address</span><b>Pallikaranai, Chennai 600100</b></p>
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
