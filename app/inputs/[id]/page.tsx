import Link from 'next/link';
import { notFound } from 'next/navigation';
import { one } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { getLang } from '@/lib/i18n';
import { INPUT_KINDS } from '@/lib/services';
import { orderInput } from '@/lib/actions/services';
import { Flash, fmtMoney } from '@/components/ui';

export const metadata = { title: 'Seeds and inputs' };

export default async function InputPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const u = await currentUser();
  const te = (await getLang(u?.lang)) === 'te';
  const i = await one("SELECT i.*, c.name AS crop, c.name_te AS crop_te, c.emoji FROM inputs i LEFT JOIN crops c ON c.id=i.crop_id WHERE i.id=$1 AND i.status='live'", [Number(id) || 0]);
  if (!i) notFound();
  const k = INPUT_KINDS[i.kind];
  const canBuy = u && ['farmer', 'consumer', 'business'].includes(u.role);
  return (
    <main className="wrap">
      <p className="small"><Link href="/inputs">← {te ? 'విత్తనాలు, ఎరువులు' : 'Seeds and inputs'}</Link></p>
      <Flash sp={sp} />
      <div className="detail">
        <div className="svc-art svc-art-lg"><span aria-hidden="true">{i.emoji ?? k.icon}</span></div>
        <div className="stack">
          <div>
            <div className="svc-kind">{k.en} · {k.te}{i.crop ? ` · ${i.crop} (${i.crop_te})` : ''}</div>
            <h1>{i.name}</h1>
            {i.name_te ? <p className="te-name">{i.name_te}</p> : null}
            <div className="svc-price big"><span><b className="num">{fmtMoney(i.price)}</b> per {i.pack}</span>{i.mrp && Number(i.mrp) > Number(i.price) ? <s className="muted">MRP {fmtMoney(i.mrp)}</s> : null}</div>
            <dl className="kv">
              <dt>Brand / variety</dt><dd>{i.brand || '—'}</dd>
              <dt>Sold by</dt><dd>{i.dealer}</dd>
              <dt>Licence</dt><dd>{i.licence_no || '—'}</dd>
              <dt>In stock</dt><dd>{i.stock} packs</dd>
            </dl>
            {i.description ? <p style={{ marginTop: 12 }}>{i.description}</p> : null}
          </div>
          {canBuy ? (
            <form action={orderInput} className="card form">
              <input type="hidden" name="id" value={i.id} />
              <label>{te ? 'ఎన్ని ప్యాకెట్లు' : 'Packs'}<input name="qty" type="number" min="1" max={Math.min(50, i.stock)} defaultValue="1" required className="qty" /></label>
              <label>{te ? 'డెలివరీ చిరునామా' : 'Deliver to'}<input name="address" defaultValue={u.address} placeholder="Village, mandal, landmark" required /></label>
              <button className="btn btn-block" disabled={i.stock < 1}>{te ? 'ఆర్డర్ చేయండి (డెలివరీలో నగదు)' : 'Order, pay cash on delivery'}</button>
            </form>
          ) : !u ? <div className="card"><p>Log in to order.</p><Link href="/login?role=farmer" className="btn">Log in</Link></div> : null}
        </div>
      </div>
    </main>
  );
}
