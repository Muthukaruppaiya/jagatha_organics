import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const FALLBACK = [
  { src: '/reels/reel-2.mp4', id: 'reel-2', title: 'No sugar, no jaggery protein bars' },
  { src: '/reels/reel-4.mp4', id: 'reel-4', title: 'No sugar, no jaggery' },
  { src: '/reels/reel-3.mp4', id: 'reel-3', title: 'Happy New Year 2026' },
  { src: '/reels/reel-1.mp4', id: 'reel-1', title: 'Back to a happy family' },
];

function frameOf(event) {
  event.currentTarget.pause();
  const video = event.currentTarget;
  if (video.currentTime < 0.2) video.currentTime = 0.6;
}

export function ReelStage() {
  const [reels, setReels] = useState(FALLBACK);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);
  const reel = reels[index] || reels[0];

  useEffect(() => {
    api.videos()
      .then((list) => {
        if (list.length) setReels(list.map((item) => ({ ...item, id: item.id || item.src })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPaused(true);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (paused) video.pause();
    else video.play().catch(() => setPaused(true));
  }, [index, paused, muted]);

  function show(next) {
    setProgress(0);
    setIndex(((next % reels.length) + reels.length) % reels.length);
    setPaused(false);
  }

  function onStageClick(event) {
    if (event.target.closest('button, a')) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    if (x < 0.22) show(index - 1);
    else if (x > 0.78) show(index + 1);
    else setPaused((value) => !value);
  }

  return (
    <div className="reel-stage">
      <div className="reel-frame" onClick={onStageClick}>
        <div className="reel-progress" aria-hidden="true">
          {reels.map((item, itemIndex) => (
            <span key={item.id}>
              <i style={{ width: itemIndex < index ? '100%' : itemIndex === index ? `${progress * 100}%` : '0%' }} />
            </span>
          ))}
        </div>
        <video
          key={reel.src}
          ref={videoRef}
          src={reel.src}
          playsInline
          muted={muted}
          autoPlay={!paused}
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            if (video.duration) setProgress(video.currentTime / video.duration);
          }}
          onEnded={() => show(index + 1)}
        />
        <button type="button" className="reel-arrow prev" aria-label="Previous clip" onClick={() => show(index - 1)}>‹</button>
        <button type="button" className="reel-arrow next" aria-label="Next clip" onClick={() => show(index + 1)}>›</button>
        <div className="reel-top">
          <span>@jagathaorganics</span>
          <div className="reel-controls">
            <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Play' : 'Pause'}>
              {paused ? 'Play' : 'Pause'}
            </button>
            <button type="button" onClick={() => setMuted((value) => !value)} aria-label={muted ? 'Turn sound on' : 'Mute'}>
              {muted ? 'Sound' : 'Mute'}
            </button>
          </div>
        </div>
        <div className="reel-caption">
          <strong>{reel?.title}</strong>
          {/[A-Za-z]/.test(String(reel?.id || '')) && (
            <a href={`https://www.instagram.com/reel/${reel.id}/`} target="_blank" rel="noreferrer">Instagram</a>
          )}
        </div>
      </div>
      <div className="reel-picks" aria-label="Choose a clip">
        {reels.map((item, itemIndex) => (
          <button key={item.id} type="button" className={itemIndex === index ? 'on' : ''} onClick={() => show(itemIndex)}>
            <video src={item.src} muted playsInline preload="metadata" onLoadedData={frameOf} />
            <em>{item.title}</em>
          </button>
        ))}
      </div>
    </div>
  );
}
