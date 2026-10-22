import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const FALLBACK = [
  { src: '/reels/reel-2.mp4', id: 'reel-2', title: 'No sugar, no jaggery protein bars' },
  { src: '/reels/reel-4.mp4', id: 'reel-4', title: 'No sugar, no jaggery' },
  { src: '/reels/reel-3.mp4', id: 'reel-3', title: 'Happy New Year 2026' },
  { src: '/reels/reel-1.mp4', id: 'reel-1', title: 'Back to a happy family' },
];

function ReelCard({ reel }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  function play() {
    videoRef.current?.play().then(() => setPlaying(true)).catch(() => {});
  }

  function stop() {
    videoRef.current?.pause();
    setPlaying(false);
  }

  return (
    <button
      type="button"
      className={playing ? 'reel-card playing' : 'reel-card'}
      aria-label={`${playing ? 'Pause' : 'Play'} ${reel.title}`}
      onMouseEnter={play}
      onMouseLeave={stop}
      onClick={() => (playing ? stop() : play())}
    >
      <video
        ref={videoRef}
        src={reel.src}
        muted
        loop
        playsInline
        preload="metadata"
        onLoadedData={(event) => {
          if (event.currentTarget.currentTime < 0.2) event.currentTarget.currentTime = 0.6;
        }}
      />
      <span className="reel-play" aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
      <em>{reel.title}</em>
    </button>
  );
}

export function ReelStrip() {
  const [reels, setReels] = useState(FALLBACK);

  useEffect(() => {
    api.videos()
      .then((list) => {
        if (!Array.isArray(list)) return;
        setReels(list.length ? list.map((item) => ({ ...item, id: item.id || item.src })) : []);
      })
      .catch(() => {});
  }, []);

  if (!reels.length) return null;

  return (
    <section className="wrap section reel-strip">
      <div className="section-head">
        <h2>From our kitchen</h2>
        <a href="https://www.instagram.com/jagathaorganics/" target="_blank" rel="noreferrer">Instagram</a>
      </div>
      <div className="reel-row">
        {reels.slice(0, 4).map((reel) => <ReelCard key={reel.id} reel={reel} />)}
      </div>
    </section>
  );
}
