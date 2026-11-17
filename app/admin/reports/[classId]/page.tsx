'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { AdminShell } from '@/components/AdminShell';
import { Badge, Button, Card, Dot, Empty, ErrorNote, ROUND_META, Spinner } from '@/components/ui';
import type { TeamScore } from '@/components/views';

type Report = {
  sessions: { id: string; title: string; code: string; created_at: string; status: string }[];
  standings: { session: { id: string; title: string; code: string; created_at: string }; teams: TeamScore[] }[];
  items: { round: string; label: string; prompt: string; answered: number; correct: number }[];
};

export default function ReportPage() {
  return (
    <AdminShell>
      <ReportView />
    </AdminShell>
  );
}

function ReportView() {
  const { classId } = useParams<{ classId: string }>();
  const [data, setData] = useState<Report | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api<Report>(`/api/admin/reports/${classId}`).then(setData).catch((e) => setErr(e.message)); }, [classId]);
  if (err) return <ErrorNote>{err}</ErrorNote>;
  if (!data) return <div className="grid place-items-center py-20"><Spinner /></div>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-black">Class report</h1>

      <Card>
        <h2 className="mb-1 text-lg font-bold">Which questions did this class miss?</h2>
        <p className="mb-4 text-sm text-muted">Percent of teams that answered correctly, across all games for this class. Lowest first, so you know what to reteach.</p>
        {data.items.length === 0 ? <Empty>No answered items yet.</Empty> : (
          <div className="flex flex-col gap-2">
            {[...data.items].sort((a, b) => a.correct / Math.max(1, a.answered) - b.correct / Math.max(1, b.answered)).map((i) => {
              const pct = Math.round((i.correct / Math.max(1, i.answered)) * 100);
              return (
                <div key={i.round + i.label} className="grid grid-cols-[90px_1fr_160px] items-center gap-3 text-sm">
                  <Badge color={ROUND_META[i.round].color}>{i.round} {i.label}</Badge>
                  <div className="min-w-0">
                    <div className="truncate text-muted">{i.prompt}</div>
                    <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct < 50 ? '#f43f5e' : pct < 75 ? '#fbbf24' : '#22c55e' }} />
                    </div>
                  </div>
                  <span className="text-right tabular-nums"><b>{pct}%</b> <span className="text-muted">({i.correct}/{i.answered} teams)</span></span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <h2 className="text-xl font-bold">Final standings</h2>
      {data.standings.length === 0 && <Empty>No games yet.</Empty>}
      {data.standings.map(({ session, teams }) => (
        <Card key={session.id}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-bold">{session.title}</div>
              <div className="text-xs text-muted">{new Date(session.created_at).toLocaleString()} · code {session.code}</div>
            </div>
            <a href={`/api/admin/sessions/${session.id}/csv`}><Button size="sm" variant="ghost">⬇ CSV</Button></a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr><th className="py-1">#</th><th>Team</th><th>Members</th>{['R1', 'R2', 'R3', 'R4', 'R5', 'Other'].map((r) => <th key={r} className="text-right">{r}</th>)}<th className="text-right">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {teams.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2">{t.rank}</td>
                    <td><span className="flex items-center gap-2 font-semibold"><Dot color={t.color} size={9} />{t.name}</span></td>
                    <td className="text-muted">{t.members.join(', ')}</td>
                    {['R1', 'R2', 'R3', 'R4', 'R5', 'Other'].map((r) => <td key={r} className="text-right tabular-nums">{t.byRound[r]}</td>)}
                    <td className="text-right font-bold tabular-nums">{t.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
