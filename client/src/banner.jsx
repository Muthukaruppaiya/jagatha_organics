import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, inr } from './api.js';

const SLIDE_MS = 5000;

function BannerArt({ src, mobileSrc, alt = '' }) {
  return (
    <picture>
      {mobileSrc ? <source media="(max-width: 760px)" srcSet={mobileSrc} /> : null}
      <img className="banner-shot" src={src} alt={alt} />
    </picture>
  );
}

function BannerButton({ banner }) {
  if (!banner.link || !banner.buttonLabel) return null;
  if (banner.link.startsWith('/')) return <Link className="btn banner-cta banner-float" to={banner.link}>{banner.buttonLabel}</Link>;
  return <a className="btn banner-cta banner-float" href={banner.link} target="_blank" rel="noreferrer">{banner.buttonLabel}</a>;
}

function bannerOffer(banner) {
  return {
    label: banner.packLabel || banner.product?.label || '',
    pricePaise: banner.pricePaise || banner.product?.pricePaise || 0,
  };
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
    const slug = banner.product?.slug;
    if (slug) {
      navigate(`/product/${slug}`);
      return;
    }
    if (banner.link?.startsWith('/')) navigate(banner.link);
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
        const offer = bannerOffer(banner);
        const combo = Boolean(banner.product || offer.pricePaise || offer.label);
        const classes = ['banner-slide', position === current && 'on', combo && 'combo'].filter(Boolean).join(' ');
        return (
          <article
            key={banner.id}
            className={classes}
            aria-hidden={position !== current}
            aria-roledescription="slide"
            aria-label={`${position + 1} of ${banners.length}`}
            onClick={combo ? (event) => { if (!event.target.closest('button, a')) order(banner); } : undefined}
          >
            <div className={banner.mobileImage ? 'banner-media phone' : 'banner-media'}>
              { !combo && banner.link
                ? (
                  <Link to={banner.link.startsWith('/') ? banner.link : '/shop'} aria-label={banner.buttonLabel || banner.title || 'Open offer'}>
                    <BannerArt src={banner.image} mobileSrc={banner.mobileImage} alt={banner.title || ''} />
                  </Link>
                )
                : <BannerArt src={banner.image} mobileSrc={banner.mobileImage} alt={banner.title || ''} />}
              {combo && (
                <button className="btn banner-cta banner-float" type="button" onClick={() => order(banner)}>
                  {banner.buttonLabel || 'Order now'}
                  {offer.label ? ` · ${offer.label}` : ''}
                  {offer.pricePaise ? ` · ${inr(offer.pricePaise)}` : ''}
                </button>
              )}
              {!combo && <BannerButton banner={banner} />}
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
