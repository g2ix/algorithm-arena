'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';

/** A request that takes longer than this is given up on, so screens retry instead of spinning forever. */
const REQUEST_TIMEOUT_MS = 15000;

export async function api<T = any>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      method: init?.method ?? (init?.json !== undefined ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
      cache: 'no-store',
      signal: init?.signal ?? ctrl.signal,
    });
  } catch (e) {
    const slow = (e as Error).name === 'AbortError';
    throw Object.assign(new Error(slow ? 'The server is taking too long. Try again in a moment.' : 'No connection to the server. Check your internet and try again.'), { status: 0 });
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data as T;
}

let supabase: SupabaseClient | null | undefined;
function realtimeClient(): SupabaseClient | null {
  if (supabase !== undefined) return supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return supabase;
}

/**
 * Load JSON from `url` and keep it fresh. When Supabase Realtime is configured,
 * changes to this session's game_state row trigger an instant reload; polling
 * is the backup (slow when Realtime is connected, fast when it is not).
 */
export function useLive<T>(url: string | null, sessionIdOrFn: string | null | undefined | ((d: T) => string | null | undefined)) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [live, setLive] = useState(false);
  const inflight = useRef(false);
  const again = useRef(false);

  const reload = useCallback(async () => {
    if (!url) return;
    if (inflight.current) {
      again.current = true;
      return;
    }
    inflight.current = true;
    try {
      setData(await api<T>(url));
      setError(null);
    } catch (e) {
      const err = e as Error & { status?: number };
      setError({ message: err.message, status: err.status });
    } finally {
      inflight.current = false;
      if (again.current) {
        again.current = false;
        void reload();
      }
    }
  }, [url]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sessionId = typeof sessionIdOrFn === 'function' ? (data ? sessionIdOrFn(data) : null) : sessionIdOrFn;

  useEffect(() => {
    const sb = realtimeClient();
    if (!sb || !sessionId) return;
    // "SUBSCRIBED" only means the socket joined. Supabase confirms (or rejects) the
    // database listener separately in a system message; trust Realtime only after "ok",
    // otherwise keep fast polling so screens never wait 15 s for a change.
    const ch = sb
      .channel(`gs-${sessionId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state', filter: `session_id=eq.${sessionId}` }, () => void reload())
      .on('system', {}, (m: { extension?: string; status?: string }) => {
        if (m?.extension === 'postgres_changes') {
          setLive(m.status === 'ok');
          if (m.status === 'ok') void reload(); // catch anything that changed while connecting
        }
      })
      .subscribe((status) => { if (status !== 'SUBSCRIBED') setLive(false); });
    return () => {
      setLive(false);
      void sb.removeChannel(ch);
    };
  }, [sessionId, reload]);

  // Timed steps (wager → get ready → answering) change on the clock, not in the database,
  // so no Realtime event fires: reload right when the server says the next step begins.
  const st = (data as { state?: { nextAt?: string | null; serverNow?: string } } | null)?.state;
  const nextAt = st?.nextAt ?? null;
  const serverNow = st?.serverNow ?? null;
  useEffect(() => {
    if (!nextAt || !serverNow) return;
    const ms = new Date(nextAt).getTime() - new Date(serverNow).getTime() + 300;
    const t = setTimeout(() => void reload(), Math.max(150, ms));
    return () => clearTimeout(t);
  }, [nextAt, serverNow, reload]);

  useEffect(() => {
    const ms = live ? 8000 : 2000;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, ms);
    const onVis = () => document.visibilityState === 'visible' && void reload();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [live, reload]);

  return { data, error, reload, live };
}

/** Seconds left until `closesAt`, corrected for the difference between this device's clock and the server's. */
export function useCountdown(closesAt: string | null | undefined, serverNow: string | null | undefined) {
  const offset = useRef(0);
  useEffect(() => {
    if (serverNow) offset.current = new Date(serverNow).getTime() - Date.now();
  }, [serverNow]);
  const calc = useCallback(
    () => (closesAt ? Math.max(0, Math.ceil((new Date(closesAt).getTime() - (Date.now() + offset.current)) / 1000)) : null),
    [closesAt],
  );
  const [left, setLeft] = useState<number | null>(calc);
  useEffect(() => {
    setLeft(calc());
    if (!closesAt) return;
    const t = setInterval(() => setLeft(calc()), 250);
    return () => clearInterval(t);
  }, [closesAt, calc]);
  return left;
}

export function fmtTime(s: number | null) {
  if (s === null) return '';
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
