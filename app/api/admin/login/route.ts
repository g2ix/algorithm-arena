import { handle, setAdminCookie, clearAdminCookie, passwordMatches, HttpError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => {
    if (!process.env.ADMIN_PASSWORD) throw new HttpError(500, 'ADMIN_PASSWORD is not set on the server yet.');
    const body = await req.json().catch(() => ({}));
    await new Promise((r) => setTimeout(r, 300));
    if (!passwordMatches(String(body.password ?? ''))) throw new HttpError(401, 'Wrong password.');
    await setAdminCookie();
    return { ok: true };
  });
}

export async function DELETE() {
  return handle(async () => { await clearAdminCookie(); return { ok: true }; });
}
