import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api.js';

const INSTAGRAM = 'https://www.instagram.com/jagathaorganics/';

const FALLBACK = [
  { src: '/reels/reel-2.mp4', id: 'reel-2', title: 'No sugar, no jaggery protein bars' },
  { src: '/reels/reel-4.mp4', id: 'reel-4', title: 'No sugar, no jaggery' },
  { src: '/reels/reel-3.mp4', id: 'reel-3', title: 'Festive kitchen sweets' },
];

function takeClips(list) {
  const next = [];
  for (const item of list) {
    const clip = { ...item, id: item.id || item.src };
    if (!clip.src || next.some((entry) => entry.src === clip.src)) continue;
    next.push(clip);
    if (next.length === 3) break;
  }
  return next;
}

function useKitchenClips() {
  const [reels, setReels] = useState(FALLBACK);

  useEffect(() => {
    api.videos()
      .then((list) => {
        if (!Array.isArray(list)) return;
        const fromShop = takeClips(list);
        setReels(fromShop.length ? takeClips([...fromShop, ...FALLBACK]) : []);
      })
      .catch(() => {});
  }, []);

  return reels;
}

function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5zm8 1.8H8A3.2 3.2 0 0 0 4.8 8v8A3.2 3.2 0 0 0 8 19.2h8A3.2 3.2 0 0 0 19.2 16V8A3.2 3.2 0 0 0 16 4.8zM12 8.2A3.8 3.8 0 1 1 8.2 12 3.8 3.8 0 0 1 12 8.2zm0 1.7A2.1 2.1 0 1 0 14.1 12 2.1 2.1 0 0 0 12 9.9zM17.4 7.1a.9.9 0 1 1-.9.9.9.9 0 0 1 .9-.9z" />
    </svg>
  );
}

export function KitchenReel() {
  const reels = useKitchenClips();
  const [current, setCurrent] = useState(0);
  const [open, setOpen] = useState(false);
  const videoRef = useRef(null);
  const fullRef = useRef(null);
  const boxRef = useRef(null);
  const clips = reels.slice(0, 3);
  const reel = clips[current] || clips[0];
  const others = clips.map((item, index) => ({ item, index })).filter(({ index }) => index !== current);

  useEffect(() => {
    if (current >= clips.length) setCurrent(0);
  }, [clips.length, current]);

  useEffect(() => {
    const node = boxRef.current;
    const video = videoRef.current;
    if (!node || !video) return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (open) return;
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    }, { threshold: 0.25 });
    io.observe(node);
    return () => io.disconnect();
  }, [reel?.src, open]);

  useEffect(() => {
    if (open || clips.length < 2) return undefined;
    const timer = setInterval(() => {
      setCurrent((index) => (index + 1) % clips.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [clips.length, current, open]);

  useEffect(() => {
    if (!open) return undefined;
    videoRef.current?.pause();
    const video = fullRef.current;
    if (video) {
      video.play().catch(() => {});
      const goFull = video.requestFullscreen || video.webkitRequestFullscreen;
      if (goFull) goFull.call(video).catch(() => {});
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onFull = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFull);
    document.addEventListener('webkitfullscreenchange', onFull);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFull);
      document.removeEventListener('webkitfullscreenchange', onFull);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [open, reel?.src]);

  if (!reel) return null;

  function openFull(event) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  }

  return (
    <aside className="home-reel" ref={boxRef}>
      <div className="home-reel-top">
        <p className="home-reel-kicker">From our kitchen</p>
        {clips.length > 1 && <span className="home-reel-count">{current + 1} / {clips.length}</span>}
      </div>
      <div className={`home-reel-stage${others.length ? '' : ' solo'}`}>
        <button type="button" className="home-reel-frame" onClick={openFull} aria-label="Open video full screen">
          <video
            ref={videoRef}
            key={reel.src}
            src={reel.src}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
          />
          <span className="home-reel-live">Playing</span>
          <div className="home-reel-copy">
            <b>{reel.title || 'Jagatha Organics'}</b>
          </div>
        </button>
        {others.length > 0 && (
          <div className="home-reel-thumbs">
            {others.map(({ item, index }) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Play ${item.title || `clip ${index + 1}`}`}
                onClick={() => setCurrent(index)}
              >
                <video
                  src={item.src}
                  muted
                  playsInline
                  preload="metadata"
                  onLoadedData={(event) => {
                    try { event.currentTarget.currentTime = 0.8; } catch { /* ignore */ }
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="home-reel-follow">
        <a className="social-btn instagram" href={INSTAGRAM} target="_blank" rel="noreferrer" aria-label="Instagram">
          <InstagramMark />
          <span>Instagram</span>
        </a>
      </div>
      {open && createPortal(
        <div className="reel-full" role="dialog" aria-modal="true" aria-label={reel.title || 'Kitchen video'}>
          <button className="reel-full-close" type="button" onClick={() => setOpen(false)}>Close</button>
          <video
            ref={fullRef}
            src={reel.src}
            autoPlay
            controls
            playsInline
            loop
          />
        </div>,
        document.body,
      )}
    </aside>
  );
}
