import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useCart } from './cart.jsx';
import { api, readCustomer, saveCustomer } from './api.js';

function Icon({ path }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

const ICON = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20c1-3.5 3.6-5 7-5s6 1.5 7 5',
  bag: 'M6 8h12l-1 12H7zM9 8a3 3 0 0 1 6 0',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
};

const SOCIAL = [
  {
    id: 'instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/jagathaorganics/',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    href: 'https://www.facebook.com/p/Jagatha-Organics-61572639235376/',
  },
];

function SocialMark({ id }) {
  if (id === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M14 8.2h2.7V5h-2.8c-2.5 0-4.2 1.7-4.2 4.4V12H7.5v3.3H9.7V22h3.5v-6.7h2.8l.5-3.3h-3.3V9.6c0-.8.4-1.4 1.3-1.4z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5zm8 1.8H8A3.2 3.2 0 0 0 4.8 8v8A3.2 3.2 0 0 0 8 19.2h8A3.2 3.2 0 0 0 19.2 16V8A3.2 3.2 0 0 0 16 4.8zM12 8.2A3.8 3.8 0 1 1 8.2 12 3.8 3.8 0 0 1 12 8.2zm0 1.7A2.1 2.1 0 1 0 14.1 12 2.1 2.1 0 0 0 12 9.9zM17.4 7.1a.9.9 0 1 1-.9.9.9.9 0 0 1 .9-.9z" />
    </svg>
  );
}

export function SocialHighlights({ compact = false }) {
  return (
    <div className={compact ? 'social-highlights compact' : 'social-highlights'}>
      {SOCIAL.map((item) => (
        <a
          key={item.id}
          className={`social-btn ${item.id}`}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          aria-label={item.label}
        >
          <SocialMark id={item.id} />
          <span>{item.label}</span>
        </a>
      ))}
    </div>
  );
}

export function StoreLayout() {
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(() => readCustomer());

  useEffect(() => {
    let live = true;
    api.accountMe()
      .then((me) => {
        if (!live) return;
        saveCustomer(me);
        setCustomer(me);
      })
      .catch(() => {
        if (!live) return;
        setCustomer(readCustomer());
      });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    setCustomer(readCustomer());
  }, [location.pathname]);

  useEffect(() => {
    const sync = () => setCustomer(readCustomer());
    window.addEventListener('jagatha-session', sync);
    return () => window.removeEventListener('jagatha-session', sync);
  }, []);

  useEffect(() => {
    api.categories()
      .then((list) => setCategories(Array.isArray(list) ? list.filter((category) => category.count !== 0) : []))
      .catch(() => {});
  }, []);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    setSearching(false);
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!searching) return undefined;
    const close = (event) => event.key === 'Escape' && setSearching(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [searching]);

  function search(event) {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
  }

  return (
    <div className="site" onClick={() => open && setOpen(false)}>
      <header className="nav glass">
        <div className="nav-row">
          <Link to="/" className="brand" aria-label="Jagatha Organics home">
            <span className="mark" aria-hidden="true" />
            <span>
              <strong>Jagatha</strong>
              <small>Organics</small>
            </span>
          </Link>
          <div className="nav-actions">
            <div className="nav-social">
              <SocialHighlights compact />
            </div>
            <button
              className={searching ? 'icon-btn on' : 'icon-btn'}
              type="button"
              aria-label={searching ? 'Close search' : 'Search'}
              aria-expanded={searching}
              onClick={(event) => { event.stopPropagation(); setSearching((value) => !value); setOpen(false); }}
            >
              <Icon path={searching ? ICON.close : ICON.search} />
            </button>
            <NavLink className="icon-btn account-link" to={customer ? '/account' : '/account/login'} aria-label={customer ? 'Account' : 'Sign in'}>
              <Icon path={ICON.user} />
            </NavLink>
            <Link to="/cart" className="icon-btn cart-link" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>
              <Icon path={ICON.bag} />
              {count > 0 && <b>{count}</b>}
            </Link>
            <button
              className="icon-btn menu"
              type="button"
              aria-expanded={open}
              aria-label="Menu"
              onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); setSearching(false); }}
            >
              <Icon path={open ? ICON.close : ICON.menu} />
            </button>
          </div>
        </div>
        {searching && (
          <form className="nav-search" onSubmit={search} onClick={(event) => event.stopPropagation()}>
            <Icon path={ICON.search} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products"
              aria-label="Search products"
              enterKeyHint="search"
            />
            <button type="submit">Search</button>
          </form>
        )}
        <nav className="subnav" aria-label="Shop">
          <NavLink to="/shop" end>All</NavLink>
          {categories.map((category) => (
            <NavLink key={category.slug} to={`/shop/${category.slug}`}>{category.name}</NavLink>
          ))}
          <NavLink to="/track">Track</NavLink>
          <NavLink to="/contact">Contact</NavLink>
        </nav>
        <nav className={open ? 'links open' : 'links'} onClick={(event) => event.stopPropagation()}>
          <NavLink to="/shop" end>All products</NavLink>
          {categories.map((category) => (
            <NavLink key={category.slug} to={`/shop/${category.slug}`}>{category.name}</NavLink>
          ))}
          <NavLink to="/track">Track order</NavLink>
          <NavLink to="/contact">Contact</NavLink>
          <NavLink to={customer ? '/account' : '/account/login'}>{customer ? 'Account' : 'Sign in'}</NavLink>
          <SocialHighlights />
        </nav>
      </header>
      <main key={location.pathname}>
        <Outlet />
      </main>
      <a
        className="wa-float"
        href={`https://wa.me/919884126032?text=${encodeURIComponent('Hello Jagatha Organics, I have a question.')}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
      >
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.6a10.6 10.6 0 0 1-5.4-1.5l-.4-.2-3.9 1 1-3.8-.3-.4A10.6 10.6 0 1 1 16 26.6zm5.8-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.7 8.7 0 0 1-4.3-3.8c-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3 14.4 14.4 0 0 0 5.5 4.9c2 .9 2.8 1 3.9.8a3.3 3.3 0 0 0 2.1-1.5 2.7 2.7 0 0 0 .2-1.5c-.1-.1-.3-.2-.6-.4z" />
        </svg>
      </a>
      <footer className="footer">
        <div className="wrap foot-row">
          <p className="brand foot-brand"><span className="mark" /> Jagatha Organics</p>
          <SocialHighlights />
          <nav className="foot-links" aria-label="Footer">
            <a href="tel:+919884126032">+91 98841 26032</a>
            <a href="mailto:jagathaorganics@gmail.com">Email</a>
            <a href="https://wa.me/919884126032" target="_blank" rel="noreferrer">WhatsApp</a>
            <Link to="/track">Track order</Link>
            <Link to="/admin/login">Admin</Link>
          </nav>
        </div>
        <p className="fine">© {new Date().getFullYear()} Jagatha Organics · Pallikaranai, Chennai</p>
      </footer>
    </div>
  );
}
