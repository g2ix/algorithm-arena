import { handle, memberToken } from '@/lib/auth';
import * as game from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    return game.lockWager(await memberToken(), body.wager);
  });
}
