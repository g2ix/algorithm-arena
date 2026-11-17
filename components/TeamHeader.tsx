'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MeView } from './views';
import { cx, Dot } from './ui';

export function TeamHeader({ data }: { data: MeView }) {
  const path = usePathname();
  const ord = (n: number) => {
    const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
    return `${n}${s}`;
  };
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-ink/85 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Dot color={data.team.color} size={14} />
          <div className="min-w-0">
            <div className="truncate font-bold leading-tight">{data.team.name}</div>
            <div className="truncate text-xs text-muted">{data.me.name} · {data.session.className}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black tabular-nums leading-none">{data.team.total}</div>
          <div className="text-xs text-muted">{ord(data.team.rank)} of {data.teamsCount}</div>
        </div>
      </div>
      <nav className="mx-auto flex max-w-xl gap-1 px-4 pb-2">
        {[['/play', 'Answer pad'], ['/team', 'Team dashboard']].map(([href, label]) => (
          <Link key={href} href={href}
            className={cx('flex-1 rounded-lg py-1.5 text-center text-sm font-semibold', path === href ? 'bg-brand text-white' : 'bg-white/5 text-muted')}>
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
