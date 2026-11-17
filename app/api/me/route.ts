import { handle, memberToken, clearMemberCookie } from '@/lib/auth';
import * as game from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => game.memberView(await memberToken()));
}

export async function DELETE() {
  return handle(async () => { await clearMemberCookie(); return { ok: true }; });
}
