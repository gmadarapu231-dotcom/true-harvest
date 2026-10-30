import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { readCart } from '@/lib/cart';
import { query } from '@/lib/db';
import { SELLABLE_SQL } from '@/lib/inventory';
import { getSettings, slots } from '@/lib/settings';
import { deliveryFeeFor, priceFor, round2 } from '@/lib/orders';
import { updateCartLine, emptyCart, checkout } from '@/lib/actions/shop';
import { CropArt, Empty, Flash, PageHead, fmtMoney, fmtKg } from '@/components/ui';

export const metadata = { title: 'Cart' };

export default async function Cart({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const u = await currentUser();
  const channel = u?.role === 'business' ? 'b2b' : 'b2c';
  const cart = await readCart();
  const s = await getSettings();
  const rows = cart.length
    ? await query(`SELECT l.id, l.variety, l.price_per_kg, l.b2b_price_per_kg, l.farmer_id, ${SELLABLE_SQL} AS sellable_kg, c.name AS crop, c.emoji, l.photo_id, u.name AS farmer_name, fp.village
                     FROM listings l JOIN crops c ON c.id=l.crop_id JOIN users u ON u.id=l.farmer_id JOIN farmer_profiles fp ON fp.user_id=l.farmer_id
                    WHERE l.id = ANY($1::int[])`, [cart.map((c) => c.listingId)])
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const lines = cart.map((c, idx) => ({ ...c, idx, l: byId.get(c.listingId) })).filter((x): x is typeof x & { l: NonNullable<typeof x.l> } => !!x.l);
  const groups = new Map<number, typeof lines>();
  for (const line of lines) groups.set(line.l.farmer_id, [...(groups.get(line.l.farmer_id) ?? []), line]);
  const items = round2(lines.reduce((sum, x) => sum + x.packKg * x.count * priceFor(x.l, channel), 0));
  const fee = lines.length ? deliveryFeeFor(s, items, channel) : 0;
  const packing = channel === 'b2c' && lines.length ? s.packing_fee : 0;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  return (
    <main className="wrap">
      <PageHead title="Your cart" sub={channel === 'b2c' && !s.multi_farmer_cart ? 'Each order comes from one farm for now.' : 'Items are grouped by farm. Each farm is packed separately.'} />
      <Flash sp={sp} />
      {!lines.length ? (
        <Empty>Your cart is empty. <Link href="/shop">Browse fresh produce</Link></Empty>
      ) : (
        <div className="detail">
          <div className="stack">
            {[...groups.entries()].map(([fid, ls]) => (
              <div key={fid} className="card">
                <h3>From {ls[0].l.farmer_name} <span className="muted small">· {ls[0].l.village}</span></h3>
                <div className="stack">
                  {ls.map((x) => {
                    const price = priceFor(x.l, channel);
                    const kg = x.packKg * x.count;
                    return (
                      <div key={x.idx} className="row" style={{ flexWrap: 'nowrap' }}>
                        <CropArt emoji={x.l.emoji} photoId={x.l.photo_id} size="sm" alt={x.l.crop} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <b>{x.l.crop}</b> <span className="muted small">{x.l.variety}</span>
                          <div className="small muted">{channel === 'b2c' ? `${x.packKg < 1 ? x.packKg * 1000 + ' g' : x.packKg + ' kg'} pack · ` : ''}{fmtMoney(price)}/kg · {fmtKg(kg)}</div>
                          {kg > x.l.sellable_kg && <div className="small" style={{ color: 'var(--chilli)' }}>Only {fmtKg(x.l.sellable_kg)} left</div>}
                        </div>
                        {channel === 'b2c' ? (
                          <form action={updateCartLine} className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
                            <input type="hidden" name="idx" value={x.idx} />
                            <button className="btn btn-ghost btn-sm" name="count" value={x.count - 1} aria-label="One less">−</button>
                            <span className="num" style={{ minWidth: 20, textAlign: 'center' }}>{x.count}</span>
                            <button className="btn btn-ghost btn-sm" name="count" value={x.count + 1} aria-label="One more">+</button>
                          </form>
                        ) : (
                          <form action={updateCartLine}><input type="hidden" name="idx" value={x.idx} /><button className="btn btn-ghost btn-sm" name="count" value={0}>Remove</button></form>
                        )}
                        <b className="num" style={{ minWidth: 70, textAlign: 'right' }}>{fmtMoney(round2(kg * price))}</b>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <form action={emptyCart}><button className="btn btn-ghost btn-sm">Empty cart</button></form>
          </div>

          <form action={checkout} className="card form">
            <h2>Delivery and payment</h2>
            <label>Address<textarea name="address" required defaultValue={u?.address} placeholder="Flat, building, street, area, landmark" /></label>
            <div className="grid2">
              <label>PIN code<input name="pin" required inputMode="numeric" pattern="\d{6}" defaultValue={u?.pin} /></label>
              <label>Delivery date<input type="date" name="delivery_date" required min={tomorrow} max={maxDate} defaultValue={tomorrow} /></label>
            </div>
            <label>Slot
              <select name="slot">{slots(s).map((sl) => <option key={sl}>{sl}</option>)}</select>
            </label>
            <fieldset>
              <legend>Payment</legend>
              <label className="check"><input type="radio" name="payment_mode" value="online" defaultChecked /> UPI, card or netbanking</label>
              {s.cod_enabled && <label className="check"><input type="radio" name="payment_mode" value="pay_on_delivery" /> Pay on delivery (UPI at the door)</label>}
            </fieldset>
            <label className="check"><input type="checkbox" name="save_address" defaultChecked /> Save this address</label>
            <dl className="kv">
              <dt>Items</dt><dd className="num">{fmtMoney(items)}</dd>
              <dt>Delivery</dt><dd className="num">{fee ? fmtMoney(fee) : 'Free'}{channel === 'b2c' && fee ? <span className="small muted"> · free above {fmtMoney(s.free_delivery_above)}</span> : null}</dd>
              {packing ? <><dt>Packing</dt><dd className="num">{fmtMoney(packing)}</dd></> : null}
              <dt><b>Total</b></dt><dd className="num" style={{ fontSize: '1.2rem' }}><b>{fmtMoney(round2(items + fee + packing))}</b></dd>
            </dl>
            {channel === 'b2c' && items < s.min_order_value && <div className="flash flash-error" style={{ margin: 0 }}>Minimum order is {fmtMoney(s.min_order_value)}. Add {fmtMoney(round2(s.min_order_value - items))} more.</div>}
            {u ? <button className="btn btn-block btn-warm">Place order</button> : <Link href="/login" className="btn btn-block">Log in to place order</Link>}
            <p className="small muted" style={{ margin: 0 }}>Stock is held for you when you place the order. Free cancellation until the farmer accepts. Refunds go back to your original payment method.</p>
          </form>
        </div>
      )}
    </main>
  );
}
