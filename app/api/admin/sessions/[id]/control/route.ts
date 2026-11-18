import { handle, requireAdmin } from '@/lib/auth';
import * as game from '@/lib/game';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    await game.control((await params).id, String(body.action), {
      itemId: body.itemId, seconds: body.seconds, board: body.board, lead: body.lead, wagerSeconds: body.wagerSeconds,
    });
  });
}
