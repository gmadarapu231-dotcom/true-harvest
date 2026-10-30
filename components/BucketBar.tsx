import { fmtKg } from './ui';

export default function BucketBar({ l, labels }: { l: any; labels: Record<string, string> }) {
  const total = Number(l.listed_kg) || 1;
  const parts = [
    ['b-sell', l.sellable_kg, labels.available], ['b-res', l.reserved_kg, labels.reserved], ['b-conf', l.confirmed_kg, labels.confirmed ?? 'Confirmed'],
    ['b-del', l.delivered_kg, labels.sold], ['b-sp', Number(l.spoiled_kg) + Number(l.rejected_kg) + Number(l.removed_kg), labels.spoiled],
  ] as const;
  return (
    <>
      <div className="bucketbar" role="img" aria-label={parts.map(([, v, n]) => `${n} ${fmtKg(v)}`).join(', ')}>
        {parts.map(([c, v]) => <i key={c} className={c} style={{ width: `${(Number(v) / total) * 100}%` }} />)}
      </div>
      <div className="legend">
        {parts.filter(([, v]) => Number(v) > 0).map(([c, v, n]) => <span key={c}><b className={c} />{n} {fmtKg(v)}</span>)}
      </div>
    </>
  );
}
