'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { AdminShell } from '@/components/AdminShell';
import { Badge, Button, Card, ErrorNote, Input, ROUND_META, Spinner } from '@/components/ui';

type Item = {
  id: string; round_id: string; label: string; prompt: string; figure_url: string | null; answer_key: unknown;
  answer_text: string | null; explanation: string | null; points: unknown; time_limit_s: number; active: boolean;
};

export default function ItemsPage() {
  return (
    <AdminShell>
      <Items />
    </AdminShell>
  );
}

function Items() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = () => api<Item[]>('/api/admin/items').then(setItems);
  useEffect(() => { void load(); }, []);
  if (!items) return <div className="grid place-items-center py-20"><Spinner /></div>;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-black">Question bank</h1>
        <p className="text-muted">These are the items from the activity doc. Edit wording, answer keys, points or timers here. Changes apply to all classes.</p>
      </div>
      {items.map((it) => (
        <Card key={it.id} className="p-4">
          <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(open === it.id ? null : it.id)}>
            <Badge color={ROUND_META[it.round_id].color}>{it.round_id} {it.label}</Badge>
            <span className="flex-1 truncate">{it.prompt}</span>
            {!it.active && <Badge>hidden</Badge>}
            <span className="text-muted">{open === it.id ? '▲' : '▼'}</span>
          </button>
          {open === it.id && <Editor item={it} onSaved={() => { void load(); }} />}
        </Card>
      ))}
    </div>
  );
}

function Editor({ item, onSaved }: { item: Item; onSaved: () => void }) {
  const [prompt, setPrompt] = useState(item.prompt);
  const [answerText, setAnswerText] = useState(item.answer_text ?? '');
  const [explanation, setExplanation] = useState(item.explanation ?? '');
  const [secs, setSecs] = useState(item.time_limit_s);
  const [active, setActive] = useState(item.active);
  const [key, setKey] = useState(JSON.stringify(item.answer_key, null, 2));
  const [pts, setPts] = useState(JSON.stringify(item.points));
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const area = 'w-full rounded-xl border border-line bg-ink/70 px-3 py-2 text-sm text-white outline-none focus:border-brand';
  return (
    <form className="mt-4 grid gap-3" onSubmit={async (e) => {
      e.preventDefault(); setErr(''); setSaved(false);
      try {
        await api(`/api/admin/items/${item.id}`, { method: 'PATCH', json: {
          prompt, answer_text: answerText, explanation, time_limit_s: secs, active, answer_key: JSON.parse(key), points: JSON.parse(pts),
        } });
        setSaved(true); onSaved();
      } catch (e2) { setErr((e2 as Error).message); }
    }}>
      <label className="text-sm text-muted">Prompt<textarea className={area} rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></label>
      <label className="text-sm text-muted">Answer shown on reveal<Input value={answerText} onChange={(e) => setAnswerText(e.target.value)} /></label>
      <label className="text-sm text-muted">Explanation<textarea className={area} rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} /></label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-muted">Answer key (JSON, used for auto-checking)<textarea className={`${area} font-mono`} rows={8} value={key} onChange={(e) => setKey(e.target.value)} /></label>
        <div className="flex flex-col gap-3">
          <label className="text-sm text-muted">Points (JSON)<Input value={pts} onChange={(e) => setPts(e.target.value)} className="font-mono text-sm" /></label>
          <label className="text-sm text-muted">Time limit (seconds)<Input type="number" value={secs} onChange={(e) => setSecs(Number(e.target.value))} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Show in games</label>
          <p className="text-xs text-muted">Key types: sequence, array, number, edge_set, cycle, yesno, or multi with parts. Points: first/correct/wrong, or wager:true, or solve/first, or win.</p>
        </div>
      </div>
      <ErrorNote>{err}</ErrorNote>
      <div className="flex items-center gap-3"><Button type="submit">Save</Button>{saved && <span className="text-sm text-win">Saved</span>}</div>
    </form>
  );
}
