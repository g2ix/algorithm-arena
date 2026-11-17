'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, Input, Logo, ROUND_META } from '@/components/ui';

export default function Home() {
  const [code, setCode] = useState('');
  const router = useRouter();
  return (
    <main className="grid-bg min-h-dvh">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-5 py-8">
        <header className="flex items-center justify-between">
          <Logo />
          <Link href="/admin" className="text-sm text-muted hover:text-white">Teacher login →</Link>
        </header>

        <section className="grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
          <div className="rise">
            <p className="mb-3 inline-block rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-semibold text-violet-200">
              CIS 2101 · Trees &amp; Graphs Tournament
            </p>
            <h1 className="text-4xl font-black leading-tight md:text-6xl">
              Trace it. Build it. <span className="text-gradient">Win it.</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg text-muted">
              Join your team, answer from your phone, and watch the scoreboard move live on the projector.
            </p>
          </div>

          <Card className="glow pop">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) router.push(`/join?code=${encodeURIComponent(code.trim().toUpperCase())}`);
              }}
              className="flex flex-col gap-3"
            >
              <label className="text-sm font-semibold text-muted" htmlFor="code">Game code</label>
              <Input
                id="code"
                autoFocus
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="e.g. ARENA7"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="text-center font-mono text-3xl tracking-[.3em]"
                maxLength={8}
              />
              <Button size="lg" type="submit" disabled={!code.trim()}>Join the game</Button>
              <Link href="/play" className="text-center text-sm text-muted hover:text-white">Already joined? Back to my team pad</Link>
            </form>
          </Card>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {(['R1', 'R2', 'R3', 'R4', 'R5'] as const).map((r, i) => (
            <div key={r} className="rise rounded-2xl border border-line bg-panel/60 p-4" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="text-2xl">{ROUND_META[r].icon}</div>
              <div className="mt-2 text-xs font-bold" style={{ color: ROUND_META[r].color }}>{r}</div>
              <div className="font-semibold">{ROUND_META[r].title}</div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
