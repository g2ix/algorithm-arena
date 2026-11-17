import { handle, requireAdmin } from '@/lib/auth';
import * as game from '@/lib/game';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    await game.renameClass(id, body.name);
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => { await requireAdmin(); await game.deleteClass((await params).id); });
}
