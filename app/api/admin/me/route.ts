import { handle, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => ({ admin: await isAdmin() }));
}
