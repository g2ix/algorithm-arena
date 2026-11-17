'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/client';
import { Button, Card, ErrorNote, Input, Logo, Spinner } from './ui';

export function AdminShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ admin: boolean }>('/api/admin/me').then((r) => setAdmin(r.admin)).catch(() => setAdmin(false));
  }, []);

  if (admin === null) return <div className="grid min-h-dvh place-items-center"><Spinner /></div>;
  if (!admin) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-5">
        <Logo />
        <Card className="pop">
          <form className="flex flex-col gap-3" onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true); setErr('');
            try { await api('/api/admin/login', { json: { password: pw } }); setAdmin(true); } catch (e2) { setErr((e2 as Error).message); }
            setBusy(false);
          }}>
            <h1 className="text-xl font-bold">Teacher login</h1>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" autoFocus />
            <ErrorNote>{err}</ErrorNote>
            <Button type="submit" disabled={busy || !pw}>{busy ? <Spinner /> : 'Log in'}</Button>
          </form>
        </Card>
      </main>
    );
  }
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-ink/80 backdrop-blur">
        <div className={`mx-auto flex items-center justify-between px-5 py-3 ${wide ? 'max-w-[1500px]' : 'max-w-6xl'}`}>
          <div className="flex items-center gap-6">
            <Logo small />
            <nav className="flex gap-4 text-sm text-muted">
              <Link href="/admin" className="hover:text-white">Classes &amp; games</Link>
              <Link href="/admin/items" className="hover:text-white">Question bank</Link>
            </nav>
          </div>
          <button className="text-sm text-muted hover:text-white" onClick={async () => { await api('/api/admin/login', { method: 'DELETE' }); setAdmin(false); }}>
            Log out
          </button>
        </div>
      </header>
      <main className={`mx-auto px-5 py-6 ${wide ? 'max-w-[1500px]' : 'max-w-6xl'}`}>{children}</main>
    </div>
  );
}
