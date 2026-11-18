'use client';

import Link from 'next/link';
import { useLive } from '@/lib/client';
import { TeamHeader } from '@/components/TeamHeader';
import { Button, Card, ROUND_META, signed, Spinner } from '@/components/ui';
import type { MeView } from '@/components/views';

export default function TeamPage() {
  const { data: me, error } = useLive<MeView>('/api/me', (d) => d.session.id);
  if (error?.status === 401) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5">
        <p className="text-muted">You haven&apos;t joined a game yet.</p>
        <Link href="/join"><Button className="w-full">Join a game</Button></Link>
      </main>
    );
  }
  if (!me) return <div className="grid min-h-dvh place-items-center"><Spinner /></div>;
  const max = Math.max(1, ...Object.values(me.team.byRound).map(Math.abs));
  const gap = me.leader && me.leader.name !== me.team.name ? me.leader.total - me.team.total : 0;

  return (
    <main className="min-h-dvh pb-10">
      <TeamHeader data={me} />
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-4">
        <Card className="pop text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Team score</div>
          <div className="text-6xl font-black tabular-nums" style={{ color: me.team.color }}>{me.team.total}</div>
          <div className="mt-1 text-muted">
            {me.ranksHidden ? '🤫 Rankings are hidden for the big reveal' : me.team.rank === 1 ? '🏆 You are in the lead!' : gap > 0 ? `${gap} point${gap === 1 ? '' : 's'} behind ${me.leader!.name}` : `Rank #${me.team.rank}`}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 font-bold">Points by round</h3>
          <div className="flex flex-col gap-2">
            {(['R1', 'R2', 'R3', 'R4', 'R5', 'Other'] as const).map((r) => {
              const v = me.team.byRound[r] ?? 0;
              if (r === 'Other' && v === 0) return null;
              return (
                <div key={r} className="grid grid-cols-[110px_1fr_44px] items-center gap-2 text-sm">
                  <span className="truncate">{ROUND_META[r].icon} {ROUND_META[r].title}</span>
                  <div className="h-3 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(Math.abs(v) / max) * 100}%`, background: v < 0 ? '#f43f5e' : ROUND_META[r].color }} />
                  </div>
                  <span className="text-right font-bold tabular-nums">{v}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 font-bold">Members</h3>
          <div className="flex flex-wrap gap-2">
            {me.team.members.map((m, i) => (
              <span key={i} className="rounded-full bg-white/5 px-3 py-1 text-sm">{m}{m === me.me.name ? ' (you)' : ''}</span>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 font-bold">Score history</h3>
          {me.feed.length === 0 ? (
            <p className="text-sm text-muted">No points yet. Your results will show up here.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {me.feed.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-muted">{f.reason}</span>
                  <span className={`font-bold tabular-nums ${f.points > 0 ? 'text-win' : 'text-lose'}`}>{signed(f.points)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
