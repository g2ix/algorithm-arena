'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Button, Card, Dot, ErrorNote, Input, Logo, Spinner } from '@/components/ui';

type Lobby = {
  session: { code: string; title: string; className: string; teamMode: 'teacher' | 'student'; maxTeamSize: number; status: string };
  teams: { id: string; name: string; color: string; n: number }[];
};

function JoinInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [code, setCode] = useState((params.get('code') ?? '').toUpperCase());
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [name, setName] = useState('');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [newTeam, setNewTeam] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(c: string) {
    setErr('');
    setBusy(true);
    try {
      setLobby(await api<Lobby>(`/api/lobby/${encodeURIComponent(c)}`));
    } catch (e) {
      setErr((e as Error).message);
      setLobby(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (code.length >= 4) void load(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!lobby) return;
    const t = setInterval(() => api<Lobby>(`/api/lobby/${lobby.session.code}`).then(setLobby).catch(() => {}), 4000);
    return () => clearInterval(t);
  }, [lobby?.session.code]); // eslint-disable-line react-hooks/exhaustive-deps

  async function join() {
    setErr('');
    setBusy(true);
    try {
      await api('/api/join', { json: { code: lobby!.session.code, name, teamId: teamId ?? undefined, newTeam: teamId ? undefined : newTeam } });
      router.push('/play');
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 py-6">
      <Logo small />
      {!lobby ? (
        <Card className="pop">
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void load(code); }}>
            <h1 className="text-2xl font-bold">Enter the game code</h1>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ARENA7" autoFocus
              className="text-center font-mono text-3xl tracking-[.3em]" maxLength={8} />
            <ErrorNote>{err}</ErrorNote>
            <Button type="submit" size="lg" disabled={busy || code.length < 4}>{busy ? <Spinner /> : 'Next'}</Button>
          </form>
        </Card>
      ) : (
        <Card className="pop flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{lobby.session.className}</p>
            <h1 className="text-2xl font-bold">{lobby.session.title}</h1>
            <p className="font-mono text-sm text-brand-2">Code {lobby.session.code}</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-muted">Your first name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Juan" maxLength={24} autoFocus />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-muted">Your team</label>
            {lobby.teams.length === 0 && lobby.session.teamMode === 'teacher' && (
              <p className="text-sm text-muted">No teams yet. Wait for your teacher to add them; this list refreshes by itself.</p>
            )}
            <div className="grid grid-cols-1 gap-2">
              {lobby.teams.map((t) => {
                const full = t.n >= lobby.session.maxTeamSize;
                return (
                  <button key={t.id} disabled={full} onClick={() => setTeamId(t.id)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${teamId === t.id ? 'border-brand bg-brand/15' : 'border-line bg-ink/40 hover:border-brand/60'} disabled:opacity-40`}>
                    <span className="flex items-center gap-3 font-semibold"><Dot color={t.color} /> {t.name}</span>
                    <span className="text-xs text-muted">{t.n}/{lobby.session.maxTeamSize}{full ? ' · full' : ''}</span>
                  </button>
                );
              })}
            </div>
            {lobby.session.teamMode === 'student' && (
              <div className="mt-1 flex flex-col gap-2">
                <p className="text-xs text-muted">{lobby.teams.length ? 'Or start a new team:' : 'Start a new team:'}</p>
                <Input value={newTeam} onChange={(e) => { setNewTeam(e.target.value); setTeamId(null); }} placeholder="New team name" maxLength={24} />
              </div>
            )}
          </div>

          <ErrorNote>{err}</ErrorNote>
          <Button size="lg" onClick={join} disabled={busy || !name.trim() || (!teamId && !newTeam.trim())}>
            {busy ? <Spinner /> : 'Join team'}
          </Button>
          <button className="text-sm text-muted hover:text-white" onClick={() => { setLobby(null); setErr(''); }}>Use a different code</button>
        </Card>
      )}
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinInner />
    </Suspense>
  );
}
