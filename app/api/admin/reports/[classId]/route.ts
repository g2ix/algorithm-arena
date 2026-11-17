import { handle, requireAdmin } from '@/lib/auth';
import * as game from '@/lib/game';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ classId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => { await requireAdmin(); return game.report((await params).classId); });
}
