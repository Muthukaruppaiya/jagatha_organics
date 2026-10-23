import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, inr } from './api.js';

const SLIDE_MS = 5000;

function BannerArt({ src }) {
  return (
    <>
      <img className="banner-fill" src={src} alt="" aria-hidden="true" />
      <img className="banner-shot" src={src} alt="" />
    </>
  );
}

function BannerButton({ banner }) {
  if (!banner.link || !banner.buttonLabel) return null;
  if (banner.link.startsWith('/')) return <Link className="btn banner-cta" to={banner.link}>{banner.buttonLabel}</Link>;
  return <a className="btn banner-cta" href={banner.link} target="_blank" rel="noreferrer">{banner.buttonLabel}</a>;
}

function ComboOffer({ banner, onOrder }) {
  const { product } = banner;
  const soldOut = product.stockQty === 0;
  const off = product.comparePaise > product.pricePaise
    ? Math.round((1 - product.pricePaise / product.comparePaise) * 100)
    : 0;
  return (
    <>
      <div className="banner-price">
        <strong>{inr(product.pricePaise)}</strong>
        {off > 0 && <s>{inr(product.comparePaise)}</s>}
        {off > 0 && <span>{off}% off</span>}
      </div>
      <p className="banner-pack">{product.label}{soldOut ? ' · sold out' : ''}</p>
      <button className="btn banner-cta" type="button" onClick={onOrder}>
        {banner.buttonLabel || 'Order now'}
      </button>
    </>
  );
}

export function HeroBanner() {
  const [banners, setBanners] = useState([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let live = true;
    api.banners().then((list) => live && setBanners(list)).catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (banners.length < 2 || paused) return undefined;
    const timer = window.setTimeout(() => setIndex((value) => (value + 1) % banners.length), SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [index, banners.length, paused]);

  function order(banner) {
    navigate(`/product/${banner.product.slug}`);
  }

  if (!banners.length) return null;
  const current = index % banners.length;
  const step = (delta) => setIndex((current + delta + banners.length) % banners.length);

  return (
    <section
      className="wrap banner-stage"
      aria-roledescription="carousel"
      aria-label="This month's combo offers"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(event) => { touchX.current = event.touches[0].clientX; }}
      onTouchEnd={(event) => {
        if (touchX.current === null) return;
        const moved = event.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(moved) > 40) step(moved < 0 ? 1 : -1);
      }}
    >
      {banners.map((banner, position) => {
        const combo = Boolean(banner.product);
        const bare = !banner.title && !banner.subtitle;
        const classes = ['banner-slide', position === current && 'on', bare && 'bare', combo && 'combo'].filter(Boolean).join(' ');
        return (
          <article
            key={banner.id}
            className={classes}
            aria-hidden={position !== current}
            aria-roledescription="slide"
            aria-label={`${position + 1} of ${banners.length}`}
            onClick={combo ? (event) => { if (!event.target.closest('button, a')) order(banner); } : undefined}
          >
            {!bare && (
              <div className="banner-copy">
                <p className="banner-kicker">{combo ? "This month's combo" : 'Jagatha Organics'}</p>
                {banner.title && <h2>{banner.title}</h2>}
                {banner.subtitle && <p className="banner-sub">{banner.subtitle}</p>}
                {combo
                  ? <ComboOffer banner={banner} onOrder={() => order(banner)} />
                  : <div className="banner-buttons"><BannerButton banner={banner} /></div>}
              </div>
            )}
            <div className="banner-media">
              {bare && !combo && banner.link
                ? (
                  <Link to={banner.link.startsWith('/') ? banner.link : '/shop'} aria-label={banner.buttonLabel || 'Open offer'}>
                    <BannerArt src={banner.image} />
                  </Link>
                )
                : <BannerArt src={banner.image} />}
              {bare && combo && (
                <button className="btn banner-cta banner-float" type="button" onClick={() => order(banner)}>
                  {banner.buttonLabel || 'Order now'} · {inr(banner.product.pricePaise)}
                </button>
              )}
            </div>
          </article>
        );
      })}
      {banners.length > 1 && (
        <div className="banner-controls">
          <button className="banner-arrow" type="button" aria-label="Previous offer" onClick={() => step(-1)}>
            ‹
          </button>
          <div className="banner-dots" role="tablist" aria-label="Offers">
            {banners.map((banner, position) => (
              <button
                key={banner.id}
                type="button"
                role="tab"
                aria-label={`Show offer ${position + 1}`}
                aria-selected={position === current}
                className={position === current ? 'on' : ''}
                onClick={() => setIndex(position)}
              />
            ))}
          </div>
          <button className="banner-arrow" type="button" aria-label="Next offer" onClick={() => step(1)}>
            ›
          </button>
        </div>
      )}
    </section>
  );
}
