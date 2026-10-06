import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLayoutEffect, useState } from 'react';
import { useCart } from './cart.jsx';
import { readCustomer } from './api.js';

export function StoreLayout() {
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const customer = readCustomer();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  function search(event) {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
    setOpen(false);
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
          <form className="nav-search" onSubmit={search}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search laddus, bars, snacks…" aria-label="Search products" />
            <button type="submit">Search</button>
          </form>
          <div className="nav-actions">
            <NavLink className="account-link" to={customer ? '/account' : '/account/login'}>{customer ? 'Account' : 'Sign in'}</NavLink>
            <Link to="/cart" className="cart-link">
              Cart
              <b>{count}</b>
            </Link>
            <button className="menu" type="button" aria-expanded={open} aria-label="Open menu" onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}>
              <span />
              <span />
            </button>
          </div>
        </div>
        <nav className="subnav" aria-label="Shop">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/shop" end>Shop</NavLink>
          <NavLink to="/shop/laddu">Laddu</NavLink>
          <NavLink to="/shop/no-sugar-no-jaggery">No sugar</NavLink>
          <NavLink to="/shop/energy-delight">Energy</NavLink>
          <NavLink to="/shop/snacks">Snacks</NavLink>
          <NavLink to="/shop/gift-boxes">Gift boxes</NavLink>
          <NavLink to="/track">Track</NavLink>
          <NavLink to="/contact">Contact</NavLink>
        </nav>
        <nav className={open ? 'links open' : 'links'} onClick={(event) => event.stopPropagation()}>
          <NavLink to="/" end onClick={() => setOpen(false)}>Home</NavLink>
          <NavLink to="/shop" end onClick={() => setOpen(false)}>Shop</NavLink>
          <NavLink to="/shop/laddu" onClick={() => setOpen(false)}>Laddu</NavLink>
          <NavLink to="/shop/no-sugar-no-jaggery" onClick={() => setOpen(false)}>No sugar</NavLink>
          <NavLink to="/shop/energy-delight" onClick={() => setOpen(false)}>Energy</NavLink>
          <NavLink to="/shop/snacks" onClick={() => setOpen(false)}>Snacks</NavLink>
          <NavLink to="/shop/gift-boxes" onClick={() => setOpen(false)}>Gift boxes</NavLink>
          <NavLink to="/track" onClick={() => setOpen(false)}>Track</NavLink>
          <NavLink to="/contact" onClick={() => setOpen(false)}>Contact</NavLink>
          <NavLink to={customer ? '/account' : '/account/login'} onClick={() => setOpen(false)}>{customer ? 'Account' : 'Sign in'}</NavLink>
        </nav>
      </header>
      <main key={location.pathname}>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="wrap foot-grid">
          <div>
            <p className="brand foot-brand"><span className="mark" /> Jagatha Organics</p>
            <p>Millet sweets, protein bars, and snacks packed in Pallikaranai, Chennai.</p>
          </div>
          <div>
            <h2>Visit</h2>
            <p>Pallikaranai, Chennai<br />Tamil Nadu 600100</p>
            <p><a href="tel:+919884126032">+91 98841 26032</a><br /><a href="mailto:jagathaorganics@gmail.com">jagathaorganics@gmail.com</a></p>
          </div>
          <div>
            <h2>Shelf</h2>
            <p><Link to="/shop/laddu">Laddu</Link></p>
            <p><Link to="/shop/no-sugar-no-jaggery">No sugar, no jaggery</Link></p>
            <p><Link to="/shop/snacks">Snacks</Link></p>
            <p><Link to="/shop/gift-boxes">Gift boxes</Link></p>
          </div>
          <div>
            <h2>Orders</h2>
            <p><Link to="/track">Track an order</Link></p>
            <p><Link to="/cart">Cart</Link></p>
            <p><a href="https://www.instagram.com/jagathaorganics/" target="_blank" rel="noreferrer">Instagram</a></p>
            <p><Link to="/admin/login">Admin</Link></p>
          </div>
        </div>
        <p className="fine">© {new Date().getFullYear()} Jagatha Organics. Eat healthy, stay healthy.</p>
      </footer>
    </div>
  );
}
