import Link from 'next/link';
import { farmerContext } from '@/lib/farmer-page';
import { query } from '@/lib/db';
import { SELLABLE_SQL } from '@/lib/inventory';
import BucketBar from '@/components/BucketBar';
import { Chip, CropArt, Empty, Flash, PageHead, fmtMoney, fmtDate } from '@/components/ui';

export const metadata = { title: 'My crops' };

export default async function FarmerListings({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { u, lang, t } = await farmerContext();
  const sp = await searchParams;
  const rows = await query(
    `SELECT l.*, ${SELLABLE_SQL} AS sellable_kg, c.name AS crop, c.name_te, c.emoji FROM listings l JOIN crops c ON c.id=l.crop_id
      WHERE l.farmer_id=$1 ORDER BY (l.status IN ('live','pending_review','paused')) DESC, l.created_at DESC`, [u.id]);
  const labels = { available: t('listing.available'), reserved: t('listing.reserved'), sold: t('listing.sold'), spoiled: t('listing.spoiled') };
  return (
    <main className="wrap">
      <PageHead title={t('nav.listings')} action={<Link href="/farmer/listings/new" className="btn btn-warm">➕ {t('farmer.addCrop')}</Link>} />
      <Flash sp={sp} />
      {!rows.length ? <Empty>{t('farmer.addCrop')}</Empty> : (
        <div className="stack">
          {rows.map((l) => (
            <Link key={l.id} href={`/farmer/listings/${l.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: 14 }}>
              <CropArt emoji={l.emoji} photoId={l.photo_id} size="sm" alt={l.crop} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <b>{lang === 'te' ? l.name_te : l.crop} · {l.variety}</b>
                  <Chip s={l.status} label={l.status === 'live' && l.sellable_kg <= 0 ? 'Sold out' : undefined} />
                </div>
                <div className="small muted">{fmtMoney(l.price_per_kg)}/kg{l.b2b_price_per_kg ? ` · ${fmtMoney(l.b2b_price_per_kg)} wholesale` : ''} · {t('listing.grade')} {l.grade} · {fmtDate(l.ready_from)} → {fmtDate(l.available_until)}</div>
                <BucketBar l={l} labels={labels} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
