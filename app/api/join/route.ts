import { handle, setMemberCookie } from '@/lib/auth';
import * as game from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const r = await game.join(body);
    await setMemberCookie(r.token);
    return { ok: true, code: r.code };
  });
}
