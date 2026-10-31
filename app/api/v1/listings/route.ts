import { browse } from '@/lib/catalog';

// Public read API for the future Flutter apps (GET /api/v1/listings?channel=b2c&category=fruits&q=mango).
export async function GET(req: Request) {
  const u = new URL(req.url);
  const channel = u.searchParams.get('channel') === 'b2b' ? 'b2b' : 'b2c';
  const rows = await browse({ channel, category: u.searchParams.get('category') ?? undefined, q: u.searchParams.get('q')?.slice(0, 60), district: u.searchParams.get('district') ?? undefined, state: u.searchParams.get('state') ?? undefined });
  return Response.json({
    data: rows.map((l) => ({
      id: l.id, crop: l.crop, crop_te: l.crop_te, category: l.category, variety: l.variety, grade: l.grade,
      price_per_kg: channel === 'b2b' && l.b2b_price_per_kg ? l.b2b_price_per_kg : l.price_per_kg,
      sellable_kg: l.sellable_kg, min_order_kg: l.min_order_kg, ready_from: l.ready_from, available_until: l.available_until,
      farmer: { id: l.farmer_id, name: l.farmer_name, village: l.village, district: l.district, rating: l.rating ? Number(l.rating) : null },
      photo_url: l.photo_id ? `/api/photo/${l.photo_id}` : null,
    })),
  });
}
