import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const FALLBACK = [
  { src: '/reels/reel-2.mp4', id: 'reel-2', title: 'No sugar, no jaggery protein bars' },
  { src: '/reels/reel-4.mp4', id: 'reel-4', title: 'No sugar, no jaggery' },
  { src: '/reels/reel-3.mp4', id: 'reel-3', title: 'Happy New Year 2026' },
  { src: '/reels/reel-1.mp4', id: 'reel-1', title: 'Back to a happy family' },
];

function useKitchenClips() {
  const [reels, setReels] = useState(FALLBACK);

  useEffect(() => {
    api.videos()
      .then((list) => {
        if (!Array.isArray(list)) return;
        setReels(list.length ? list.map((item) => ({ ...item, id: item.id || item.src })) : []);
      })
      .catch(() => {});
  }, []);

  return reels;
}

export function KitchenReel() {
  const reels = useKitchenClips();
  const [current, setCurrent] = useState(0);
  const videoRef = useRef(null);
  const boxRef = useRef(null);
  const clips = reels.slice(0, 4);
  const reel = clips[current] || clips[0];

  useEffect(() => {
    const node = boxRef.current;
    const video = videoRef.current;
    if (!node || !video) return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    }, { threshold: 0.25 });
    io.observe(node);
    return () => io.disconnect();
  }, [reel?.src]);

  useEffect(() => {
    if (clips.length < 2) return undefined;
    const timer = setInterval(() => {
      setCurrent((index) => (index + 1) % clips.length);
    }, 9000);
    return () => clearInterval(timer);
  }, [clips.length, current]);

  if (!reel) return null;

  return (
    <aside className="home-reel" ref={boxRef}>
      <p className="home-reel-kicker">From our kitchen</p>
      <div className="home-reel-frame">
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
          <a href="https://www.instagram.com/jagathaorganics/" target="_blank" rel="noreferrer">Watch more on Instagram</a>
        </div>
      </div>
      {clips.length > 1 && (
        <div className="home-reel-thumbs">
          {clips.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={index === current ? 'on' : ''}
              aria-label={item.title || `Clip ${index + 1}`}
              onClick={() => setCurrent(index)}
            >
              <video src={item.src} muted playsInline preload="metadata" />
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
