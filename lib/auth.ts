import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const ADMIN_COOKIE = 'arena_admin';
const MEMBER_COOKIE = 'arena_member';
const ADMIN_DAYS = 7;

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error('Set SESSION_SECRET and ADMIN_PASSWORD in your environment variables.');
  return s;
}

function sign(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function passwordMatches(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  return safeEqual(sign(input), sign(pw));
}

export async function setAdminCookie() {
  const exp = Date.now() + ADMIN_DAYS * 86400_000;
  const value = `${exp}.${sign(String(exp))}`;
  (await cookies()).set(ADMIN_COOKIE, value, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: ADMIN_DAYS * 86400,
  });
}

export async function clearAdminCookie() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const v = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!v) return false;
  const [exp, sig] = v.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  try {
    return safeEqual(sig, sign(exp));
  } catch {
    return false;
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new HttpError(401, 'Please log in as the teacher.');
}

export function newDeviceToken() {
  return randomBytes(24).toString('base64url');
}

export async function setMemberCookie(token: string) {
  (await cookies()).set(MEMBER_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 30 * 86400,
  });
}

export async function memberToken(): Promise<string | null> {
  return (await cookies()).get(MEMBER_COOKIE)?.value ?? null;
}

export async function clearMemberCookie() {
  (await cookies()).delete(MEMBER_COOKIE);
}

/** Wrap a route handler body: turns thrown errors into JSON responses. */
export async function handle(fn: () => Promise<unknown>): Promise<Response> {
  try {
    const data = await fn();
    return Response.json(data ?? { ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    const msg = e instanceof Error ? e.message : 'Something went wrong';
    return Response.json({ error: msg }, { status: 500 });
  }
}
