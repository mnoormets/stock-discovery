import { handleCollectRequest } from '@/lib/collect-route-handler';

export async function POST(req: Request) {
  return handleCollectRequest(req);
}

export const dynamic = 'force-dynamic';
