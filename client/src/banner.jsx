import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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

function bannerOffer(banner) {
  const pricePaise = banner.pricePaise || banner.product?.pricePaise || 0;
  const comparePaise = banner.comparePaise || banner.product?.comparePaise || 0;
  return {
    pricePaise,
    comparePaise: comparePaise > pricePaise ? comparePaise : 0,
  };
}

function bannerHref(banner) {
  if (banner.product?.slug) return `/product/${banner.product.slug}`;
  if (banner.link?.startsWith('/')) return banner.link;
  return '/shop';
}

function PriceMark({ banner }) {
  const { pricePaise, comparePaise } = bannerOffer(banner);
  if (!pricePaise) return null;
  return (
    <span className="banner-price-tag">
      <em>₹</em>
      <span>
        <strong>{Math.round(pricePaise / 100).toLocaleString('en-IN')}</strong>
        {comparePaise > 0 && <s>{inr(comparePaise)}</s>}
      </span>
    </span>
  );
}

export function HeroBanner() {
  const [banners, setBanners] = useState([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);
  const swiped = useRef(false);

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

  if (!banners.length) return null;
  const current = index % banners.length;
  const canStep = banners.length > 1;
  const step = (delta) => setIndex((current + delta + banners.length) % banners.length);

  return (
    <section
      className={`wrap banner-stage${canStep ? ' steppable' : ''}`}
      aria-roledescription="carousel"
      aria-label="This month's combo offers"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(event) => { touchX.current = event.touches[0].clientX; swiped.current = false; }}
      onTouchEnd={(event) => {
        if (touchX.current === null) return;
        const moved = event.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(moved) > 40) {
          swiped.current = true;
          step(moved < 0 ? 1 : -1);
        }
      }}
    >
      {banners.map((banner, position) => {
        const href = bannerHref(banner);
        const classes = ['banner-slide', position === current && 'on'].filter(Boolean).join(' ');
        return (
          <Link
            key={banner.id}
            to={href}
            className={classes}
            aria-hidden={position !== current}
            tabIndex={position === current ? 0 : -1}
            aria-label={banner.title || banner.buttonLabel || 'Open offer'}
            onClick={(event) => {
              if (swiped.current) {
                event.preventDefault();
                swiped.current = false;
              }
            }}
          >
            <div className={banner.mobileImage ? 'banner-media phone' : 'banner-media'}>
              <BannerArt src={banner.image} mobileSrc={banner.mobileImage} alt="" />
              <PriceMark banner={banner} />
            </div>
          </Link>
        );
      })}
      {canStep && (
        <>
          <button className="banner-arrow prev" type="button" aria-label="Previous banner" onClick={(event) => { event.preventDefault(); event.stopPropagation(); step(-1); }}>‹</button>
          <button className="banner-arrow next" type="button" aria-label="Next banner" onClick={(event) => { event.preventDefault(); event.stopPropagation(); step(1); }}>›</button>
        </>
      )}
    </section>
  );
}
