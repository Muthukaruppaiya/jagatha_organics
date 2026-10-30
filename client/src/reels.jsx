import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api.js';

const INSTAGRAM = 'https://www.instagram.com/jagathaorganics/';
const YOUTUBE = 'https://youtube.com/@jagathaorganics';

function posterFor(src) {
  if (typeof src !== 'string') return '';
  if (src.startsWith('/reels/') && src.endsWith('.mp4')) return src.replace(/\.mp4$/, '.jpg');
  return '';
}

const FALLBACK = [
  { src: '/reels/reel-2.mp4', id: 'reel-2', title: 'No sugar, no jaggery protein bars', poster: '/reels/reel-2.jpg' },
  { src: '/reels/reel-4.mp4', id: 'reel-4', title: 'No sugar, no jaggery', poster: '/reels/reel-4.jpg' },
  { src: '/reels/reel-3.mp4', id: 'reel-3', title: 'Festive kitchen sweets', poster: '/reels/reel-3.jpg' },
];

function takeClips(list) {
  const next = [];
  for (const item of list) {
    const clip = {
      ...item,
      id: item.id || item.src,
      poster: item.poster || posterFor(item.src),
    };
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
        setReels(takeClips([...list, ...FALLBACK]));
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

function YouTubeMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M23 8.2a3.2 3.2 0 0 0-2.2-2.3C18.9 5.5 12 5.5 12 5.5s-6.9 0-8.8.4A3.2 3.2 0 0 0 1 8.2 33 33 0 0 0 .5 12a33 33 0 0 0 .5 3.8 3.2 3.2 0 0 0 2.2 2.3c1.9.4 8.8.4 8.8.4s6.9 0 8.8-.4A3.2 3.2 0 0 0 23 15.8 33 33 0 0 0 23.5 12 33 33 0 0 0 23 8.2zM9.8 15.5v-7l6.2 3.5z" />
    </svg>
  );
}

function prepFullPlayback(video, time) {
  if (!video) return;
  try { video.currentTime = time; } catch { /* ignore */ }
  video.muted = false;
  video.controls = true;
  video.playsInline = false;
  video.removeAttribute('playsinline');
  video.removeAttribute('webkit-playsinline');
  video.play().catch(() => {});
}

function tryNativeFullscreen(video) {
  if (!video) return false;
  try {
    if (typeof video.webkitEnterFullscreen === 'function') {
      video.webkitEnterFullscreen();
      return true;
    }
    if (typeof video.webkitSetPresentationMode === 'function') {
      video.webkitSetPresentationMode('fullscreen');
      return true;
    }
    const request = video.requestFullscreen
      || video.webkitRequestFullscreen
      || video.mozRequestFullScreen
      || video.msRequestFullscreen;
    if (request) {
      request.call(video);
      return true;
    }
  } catch { /* overlay stays open */ }
  return false;
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
    document.body.classList.toggle('reel-open', open);
    return () => document.body.classList.remove('reel-open');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    videoRef.current?.pause();
    fullRef.current?.play().catch(() => {});
    const onKey = (event) => {
      if (event.key === 'Escape') closeFull();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, reel?.src]);

  function restorePreview() {
    const preview = videoRef.current;
    if (!preview) return;
    preview.controls = false;
    preview.muted = true;
    preview.playsInline = true;
    preview.setAttribute('playsinline', '');
    preview.play().catch(() => {});
  }

  function closeFull() {
    const video = fullRef.current;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    if (video?.webkitDisplayingFullscreen) video.webkitExitFullscreen?.();
    video?.pause();
    setOpen(false);
    restorePreview();
  }

  function openFull(event) {
    event.preventDefault();
    event.stopPropagation();
    const preview = videoRef.current;
    const full = fullRef.current;
    const time = preview?.currentTime || 0;

    preview?.pause();
    prepFullPlayback(full, time);
    setOpen(true);

    preview?.addEventListener('webkitendfullscreen', closeFull, { once: true });
    full?.addEventListener('webkitendfullscreen', closeFull, { once: true });

    if (preview && typeof preview.webkitEnterFullscreen === 'function') {
      prepFullPlayback(preview, time);
      tryNativeFullscreen(preview);
      return;
    }

    if (!tryNativeFullscreen(full) && !tryNativeFullscreen(preview)) {
      try {
        document.documentElement.requestFullscreen?.();
      } catch { /* overlay already covers the phone */ }
    }
  }

  if (!reel) return null;

  return (
    <aside className="home-reel" ref={boxRef}>
      <div className="home-reel-top">
        <p className="home-reel-kicker">From our kitchen</p>
        {clips.length > 1 && <span className="home-reel-count">{current + 1} / {clips.length}</span>}
      </div>
      <div className={`home-reel-stage${others.length ? '' : ' solo'}`}>
        <div
          className="home-reel-frame"
          role="button"
          tabIndex={0}
          onClick={openFull}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openFull(event); }}
          aria-label="Open video full screen"
        >
          <video
            ref={videoRef}
            key={reel.src}
            src={reel.src}
            poster={reel.poster || undefined}
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
          />
          <span className="home-reel-live">Playing</span>
          <div className="home-reel-copy">
            <b>{reel.title || 'Jagatha Organics'}</b>
          </div>
        </div>
        {others.length > 0 && (
          <div className="home-reel-thumbs">
            {others.map(({ item, index }) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Play ${item.title || `clip ${index + 1}`}`}
                onClick={() => setCurrent(index)}
              >
                {item.poster ? (
                  <img src={item.poster} alt="" />
                ) : (
                  <video src={item.src} muted playsInline preload="auto" />
                )}
                <span className="home-reel-thumb-play" aria-hidden="true" />
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
        <a className="social-btn youtube" href={YOUTUBE} target="_blank" rel="noreferrer" aria-label="YouTube">
          <YouTubeMark />
          <span>YouTube</span>
        </a>
      </div>
      {createPortal(
        <div
          className={open ? 'reel-full on' : 'reel-full'}
          role="dialog"
          aria-modal={open}
          aria-hidden={!open}
          aria-label={reel.title || 'Kitchen video'}
        >
          <button className="reel-full-close" type="button" onClick={closeFull}>Close</button>
          <video
            ref={fullRef}
            src={reel.src}
            loop
            controls
            preload="auto"
          />
        </div>,
        document.body,
      )}
    </aside>
  );
}
