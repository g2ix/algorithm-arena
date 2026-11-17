'use client';

/** Small dependency-free confetti burst on a full-screen canvas. */
export function confetti(colors: string[] = ['#a78bfa', '#22d3ee', '#fbbf24', '#22c55e', '#f43f5e']) {
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999';
  c.width = innerWidth * devicePixelRatio;
  c.height = innerHeight * devicePixelRatio;
  document.body.appendChild(c);
  const ctx = c.getContext('2d')!;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const parts = Array.from({ length: 180 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.4,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 16 - 4,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    w: 6 + Math.random() * 8,
    h: 4 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  function frame(t: number) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.45;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (t - start < 3500) requestAnimationFrame(frame);
    else c.remove();
  }
  requestAnimationFrame(frame);
}

let audio: AudioContext | null = null;
/** Short synth sounds; no audio files needed. */
export function sound(kind: 'ding' | 'fanfare' | 'tick' | 'buzz') {
  try {
    audio ??= new AudioContext();
    const notes: Record<typeof kind, [number, number][]> = {
      ding: [[880, 0], [1320, 0.08]],
      fanfare: [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36]],
      tick: [[1200, 0]],
      buzz: [[140, 0]],
    };
    for (const [f, at] of notes[kind]) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = kind === 'buzz' ? 'sawtooth' : 'triangle';
      o.frequency.value = f;
      const t0 = audio.currentTime + at;
      const len = kind === 'tick' ? 0.05 : kind === 'buzz' ? 0.4 : 0.25;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(kind === 'tick' ? 0.05 : 0.18, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      o.connect(g).connect(audio.destination);
      o.start(t0);
      o.stop(t0 + len + 0.05);
    }
  } catch {
    /* audio not available */
  }
}
