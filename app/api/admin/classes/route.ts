import { handle, requireAdmin } from '@/lib/auth';
import * as game from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => { await requireAdmin(); return game.listClasses(); });
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    return game.createClass(body.name, body.schoolYear);
  });
}
