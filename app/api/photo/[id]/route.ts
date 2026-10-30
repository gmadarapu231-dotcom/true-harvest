import { one } from '@/lib/db';
import { currentUser } from '@/lib/auth';

// Crop photos are public. Any other photo (complaint evidence) is visible to ops only.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id) || 0;
  const p = await one<{ mime: string; data: Buffer; public: boolean }>(
    'SELECT mime, data, EXISTS (SELECT 1 FROM listings WHERE photo_id = photos.id) AS public FROM photos WHERE id=$1', [id]);
  if (!p) return new Response('Not found', { status: 404 });
  if (!p.public && (await currentUser())?.role !== 'admin') return new Response('Forbidden', { status: 403 });
  return new Response(new Uint8Array(p.data), {
    headers: { 'Content-Type': p.mime, 'Cache-Control': p.public ? 'public, max-age=86400' : 'private, no-store' },
  });
}
