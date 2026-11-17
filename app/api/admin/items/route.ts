import { handle, requireAdmin } from '@/lib/auth';
import * as game from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => { await requireAdmin(); return game.listItems(); });
}
