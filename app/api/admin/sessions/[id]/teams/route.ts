import { handle, requireAdmin } from '@/lib/auth';
import * as game from '@/lib/game';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    return game.addTeam((await params).id, body.name);
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    await game.renameTeam((await params).id, body.teamId, body.name);
  });
}

export async function DELETE(req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    await game.deleteTeam((await params).id, body.teamId);
  });
}
