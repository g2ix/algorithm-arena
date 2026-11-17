'use client';

import { cx, ROUND_META } from '@/components/ui';

export type PickItem = { id: string; round: string; label: string; prompt: string };

/** Checklist of questions grouped by round, with All / None per round. */
export function QuestionPicker({ items, selected, onChange, maxHeight = '60vh' }: {
  items: PickItem[]; selected: Set<string>; onChange: (next: Set<string>) => void; maxHeight?: string;
}) {
  const rounds = (['R1', 'R2', 'R3', 'R4', 'R5'] as const).filter((r) => items.some((i) => i.round === r));
  const set = (ids: string[], on: boolean) => {
    const next = new Set(selected);
    for (const id of ids) (on ? next.add(id) : next.delete(id));
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-3 overflow-y-auto pr-1" style={{ maxHeight }}>
      {rounds.map((r) => {
        const list = items.filter((i) => i.round === r);
        const n = list.filter((i) => selected.has(i.id)).length;
        return (
          <div key={r} className="rounded-xl border border-line p-2">
            <div className="flex items-center justify-between gap-2 px-1 pb-1">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: ROUND_META[r].color }}>
                {ROUND_META[r].icon} {r} · {ROUND_META[r].title} <span className="text-muted">({n}/{list.length})</span>
              </span>
              <span className="flex gap-1 text-xs">
                <button type="button" className="rounded px-2 py-0.5 text-muted hover:bg-white/10 hover:text-white" onClick={() => set(list.map((i) => i.id), true)}>All</button>
                <button type="button" className="rounded px-2 py-0.5 text-muted hover:bg-white/10 hover:text-white" onClick={() => set(list.map((i) => i.id), false)}>None</button>
              </span>
            </div>
            {list.map((i) => {
              const on = selected.has(i.id);
              return (
                <label key={i.id} className={cx('flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1 text-sm', on ? 'bg-brand/10' : 'opacity-60 hover:opacity-100')}>
                  <input type="checkbox" className="mt-1 accent-violet-500" checked={on} onChange={(e) => set([i.id], e.target.checked)} />
                  <span className="w-12 shrink-0 font-mono font-bold">{i.label}</span>
                  <span className="line-clamp-2 flex-1 text-muted">{i.prompt}</span>
                </label>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
