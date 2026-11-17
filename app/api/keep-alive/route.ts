import { handle } from '@/lib/auth';
import * as game from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(() => game.keepAlive());
}
