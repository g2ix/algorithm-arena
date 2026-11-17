'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { AdminShell } from '@/components/AdminShell';
import { Badge, Button, Card, Empty, ErrorNote, Input } from '@/components/ui';

type Cls = { id: string; name: string; school_year: string | null; sessions: number };
type Sess = { id: string; class_id: string; class_name: string; code: string; title: string; status: string; team_mode: string; teams: number; created_at: string };

export default function AdminHome() {
  return (
    <AdminShell>
      <Dashboard />
    </AdminShell>
  );
}

function Dashboard() {
  const [classes, setClasses] = useState<Cls[]>([]);
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try {
      setClasses(await api('/api/admin/classes'));
      setSessions(await api('/api/admin/sessions'));
    } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Classes &amp; games</h1>
          <p className="text-muted">Create your classes once, then start a new game for each activity run.</p>
        </div>
      </div>
      <ErrorNote>{err}</ErrorNote>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-5">
          {classes.length === 0 && <Empty>No classes yet. Add your 3 classes on the right.</Empty>}
          {classes.map((c) => (
            <ClassBlock key={c.id} cls={c} sessions={sessions.filter((s) => s.class_id === c.id)} reload={load} />
          ))}
        </div>
        <div className="flex flex-col gap-5">
          <NewClass reload={load} />
          {classes.length > 0 && <NewSession classes={classes} reload={load} />}
        </div>
      </div>
    </div>
  );
}

function ClassBlock({ cls, sessions, reload }: { cls: Cls; sessions: Sess[]; reload: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cls.name);
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {editing ? (
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); await api(`/api/admin/classes/${cls.id}`, { method: 'PATCH', json: { name } }); setEditing(false); reload(); }}>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="py-1.5" />
            <Button size="sm" type="submit">Save</Button>
          </form>
        ) : (
          <div>
            <h2 className="text-xl font-bold">{cls.name}</h2>
            {cls.school_year && <div className="text-xs text-muted">{cls.school_year}</div>}
          </div>
        )}
        <div className="flex gap-2">
          <Link href={`/admin/reports/${cls.id}`}><Button size="sm" variant="ghost">📊 Report</Button></Link>
          <Button size="sm" variant="ghost" onClick={() => setEditing(!editing)}>Rename</Button>
          <Button size="sm" variant="ghost" onClick={async () => {
            if (!confirm(`Delete ${cls.name} and ALL its games and scores? This cannot be undone.`)) return;
            await api(`/api/admin/classes/${cls.id}`, { method: 'DELETE' }); reload();
          }}>Delete</Button>
        </div>
      </div>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted">No games yet for this class.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  {s.title}
                  <Badge color={s.status === 'live' ? '#22c55e' : s.status === 'ended' ? '#94a3b8' : '#22d3ee'}>{s.status}</Badge>
                </div>
                <div className="text-xs text-muted">
                  Code <span className="font-mono text-brand-2">{s.code}</span> · {s.teams} teams · {new Date(s.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-2">
                <a href={`/board/${s.code}`} target="_blank" rel="noreferrer"><Button size="sm" variant="outline">📺 Board</Button></a>
                <Link href={`/admin/session/${s.id}`}><Button size="sm">🎮 Control</Button></Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function NewClass({ reload }: { reload: () => void }) {
  const [name, setName] = useState('');
  const [sy, setSy] = useState('');
  const [err, setErr] = useState('');
  return (
    <Card>
      <h2 className="mb-3 text-lg font-bold">Add a class</h2>
      <form className="flex flex-col gap-2" onSubmit={async (e) => {
        e.preventDefault(); setErr('');
        try { await api('/api/admin/classes', { json: { name, schoolYear: sy } }); setName(''); reload(); } catch (e2) { setErr((e2 as Error).message); }
      }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CIS 2101 – Group 1" />
        <Input value={sy} onChange={(e) => setSy(e.target.value)} placeholder="School year (optional)" />
        <ErrorNote>{err}</ErrorNote>
        <Button type="submit" disabled={!name.trim()}>Add class</Button>
      </form>
    </Card>
  );
}

function NewSession({ classes, reload }: { classes: Cls[]; reload: () => void }) {
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [title, setTitle] = useState('Trees & Graphs Tournament');
  const [mode, setMode] = useState<'teacher' | 'student'>('teacher');
  const [size, setSize] = useState(4);
  const [teams, setTeams] = useState('Team 1\nTeam 2\nTeam 3\nTeam 4\nTeam 5\nTeam 6');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Card className="glow">
      <h2 className="mb-3 text-lg font-bold">Start a new game</h2>
      <form className="flex flex-col gap-3" onSubmit={async (e) => {
        e.preventDefault(); setErr(''); setBusy(true);
        try {
          const r = await api<{ id: string }>('/api/admin/sessions', { json: { classId, title, teamMode: mode, maxTeamSize: size, teams: mode === 'teacher' ? teams.split('\n') : [] } });
          location.href = `/admin/session/${r.id}`;
        } catch (e2) { setErr((e2 as Error).message); setBusy(false); }
        reload();
      }}>
        <label className="flex flex-col gap-1 text-sm text-muted">Class
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-xl border border-line bg-ink/70 px-3 py-2.5 text-white">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">Title
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {(['teacher', 'student'] as const).map((m) => (
            <button type="button" key={m} onClick={() => setMode(m)}
              className={`rounded-xl border p-3 text-left ${mode === m ? 'border-brand bg-brand/15' : 'border-line'}`}>
              <div className="font-semibold">{m === 'teacher' ? 'I make the teams' : 'Students make teams'}</div>
              <div className="text-xs text-muted">{m === 'teacher' ? 'Students pick from your list' : 'They type a team name when joining'}</div>
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-2 text-sm text-muted">Max members per team
          <Input type="number" min={1} max={10} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-20 py-1.5 text-center" />
        </label>
        {mode === 'teacher' && (
          <label className="flex flex-col gap-1 text-sm text-muted">Team names (one per line)
            <textarea value={teams} onChange={(e) => setTeams(e.target.value)} rows={6}
              className="rounded-xl border border-line bg-ink/70 px-3 py-2 font-mono text-sm text-white outline-none focus:border-brand" />
          </label>
        )}
        <ErrorNote>{err}</ErrorNote>
        <Button type="submit" size="lg" disabled={busy || !classId}>Create game</Button>
      </form>
    </Card>
  );
}
