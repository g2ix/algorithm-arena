'use client';

import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type Variant = 'primary' | 'ghost' | 'danger' | 'success' | 'outline';
const variants: Record<Variant, string> = {
  primary: 'bg-brand hover:bg-brand/90 text-white shadow-lg shadow-brand/30',
  success: 'bg-win hover:bg-win/90 text-ink font-bold',
  danger: 'bg-lose/90 hover:bg-lose text-white',
  ghost: 'bg-white/5 hover:bg-white/10 text-white',
  outline: 'border border-line hover:border-brand hover:bg-brand/10 text-white',
};

export function Button({ variant = 'primary', size = 'md', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2.5',
        size === 'lg' && 'px-6 py-4 text-lg',
        variants[variant],
        className,
      )}
    />
  );
}

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...p}
      className={cx(
        'w-full rounded-xl border border-line bg-ink/70 px-4 py-3 text-white placeholder:text-muted/70 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30',
        className,
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-line bg-panel/80 backdrop-blur p-5', className)}>{children}</div>;
}

export function Badge({ children, color, className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', !color && 'bg-white/10 text-muted', className)}
      style={color ? { background: `${color}26`, color } : undefined}
    >
      {children}
    </span>
  );
}

export function Dot({ color, size = 12 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ background: color, width: size, height: size, boxShadow: `0 0 12px ${color}` }} />;
}

export function Spinner() {
  return <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />;
}

export function Logo({ small }: { small?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2 font-black tracking-tight">
      <svg width={small ? 26 : 34} height={small ? 26 : 34} viewBox="0 0 40 40" aria-hidden>
        <defs>
          <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <line x1="20" y1="8" x2="10" y2="22" stroke="url(#lg)" strokeWidth="3" />
        <line x1="20" y1="8" x2="30" y2="22" stroke="url(#lg)" strokeWidth="3" />
        <line x1="10" y1="22" x2="6" y2="34" stroke="url(#lg)" strokeWidth="3" />
        <line x1="10" y1="22" x2="16" y2="34" stroke="url(#lg)" strokeWidth="3" />
        <line x1="30" y1="22" x2="30" y2="34" stroke="url(#lg)" strokeWidth="3" />
        {[[20, 8], [10, 22], [30, 22], [6, 34], [16, 34], [30, 34]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="4.2" fill="#070b1a" stroke="url(#lg)" strokeWidth="2.6" />
        ))}
      </svg>
      <span className={small ? 'text-lg' : 'text-xl'}>
        Algorithm <span className="text-gradient">Arena</span>
      </span>
    </Link>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div className="rounded-xl border border-lose/40 bg-lose/10 px-4 py-3 text-sm text-rose-200">{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">{children}</div>;
}

export const ROUND_META: Record<string, { title: string; color: string; icon: string }> = {
  R1: { title: 'Trace Race', color: '#22d3ee', icon: '⚡' },
  R2: { title: 'Human Tree', color: '#22c55e', icon: '🌳' },
  R3: { title: 'Map Heist', color: '#fbbf24', icon: '🗺️' },
  R4: { title: 'Code Sprint', color: '#a78bfa', icon: '💻' },
  R5: { title: 'Bug Hunt', color: '#f43f5e', icon: '🐞' },
  Other: { title: 'Bonus', color: '#94a3b8', icon: '✚' },
};

export function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}
