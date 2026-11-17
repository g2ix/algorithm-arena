import { handle, requireAdmin } from '@/lib/auth';
import * as game from '@/lib/game';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => { await requireAdmin(); return game.adminSessionView((await params).id); });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    await game.updateSession((await params).id, body);
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => { await requireAdmin(); await game.deleteSession((await params).id); });
}
