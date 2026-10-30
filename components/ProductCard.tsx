import Link from 'next/link';
import { CropArt, Chip, fmtMoney, fmtDate, Stars } from './ui';

export default function ProductCard({ l, channel }: { l: any; channel: 'b2c' | 'b2b' }) {
  const price = channel === 'b2b' && l.b2b_price_per_kg ? l.b2b_price_per_kg : l.price_per_kg;
  const future = l.ready_from > new Date().toISOString().slice(0, 10);
  return (
    <Link href={`/shop/${l.id}`} className="card product">
      <CropArt emoji={l.emoji} photoId={l.photo_id} alt={`${l.crop} from ${l.farmer_name}`} />
      <div>
        <h3>{l.crop} <span className="muted small">· {l.variety}</span></h3>
        <div className="farm">{l.farmer_name} · {l.village}, {l.district}</div>
      </div>
      <div className="row small">
        <Chip s="muted" label={`Grade ${l.grade}`} />
        {future ? <Chip s="pending" label={`Ready ${fmtDate(l.ready_from)}`} /> : <Chip s="ok" label={`Harvest ${fmtDate(l.ready_from)}`} />}
      </div>
      <div className="meta">
        <span className="price num">{fmtMoney(price)}<span className="muted small">/kg</span></span>
        <Stars n={l.rating ? Number(l.rating) : null} />
      </div>
      {channel === 'b2b' && <div className="small muted">Min. {l.min_order_kg} kg · {Math.floor(l.sellable_kg)} kg available</div>}
    </Link>
  );
}
