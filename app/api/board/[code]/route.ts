import { handle } from '@/lib/auth';
import * as game from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return handle(() => game.boardView(code));
}
