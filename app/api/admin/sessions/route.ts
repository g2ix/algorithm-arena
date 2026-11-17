import { handle, requireAdmin } from '@/lib/auth';
import * as game from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const classId = new URL(req.url).searchParams.get('classId') || undefined;
    return game.listSessions(classId);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    return game.createSession(body);
  });
}
