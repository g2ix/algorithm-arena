import { isAdmin } from '@/lib/auth';
import * as game from '@/lib/game';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return new Response('Please log in as the teacher.', { status: 401 });
  const { filename, csv } = await game.sessionCsv((await params).id);
  return new Response('\ufeff' + csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` },
  });
}
