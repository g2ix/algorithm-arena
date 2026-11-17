import { handle, requireAdmin } from '@/lib/auth';
import * as game from '@/lib/game';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    await game.adjust((await params).id, body.teamId, body.points, body.reason);
  });
}

export async function DELETE(req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    await game.deleteEvent((await params).id, body.eventId);
  });
}
