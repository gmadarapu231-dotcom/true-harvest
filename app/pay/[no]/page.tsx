import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { one } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { payTestMode } from '@/lib/actions/shop';
import { Flash, fmtMoney } from '@/components/ui';

export const metadata = { title: 'Payment' };

// Stand-in for Razorpay Checkout. Swap this page for the hosted checkout and confirm via webhook (R-11.1).
export default async function Pay({ params, searchParams }: { params: Promise<{ no: string }>; searchParams: Promise<Record<string, string>> }) {
  const u = await requireUser('consumer', 'business');
  const { no } = await params;
  const sp = await searchParams;
  const o = await one('SELECT * FROM orders WHERE order_no=$1 AND buyer_id=$2', [no, u.id]);
  if (!o) notFound();
  const s = await getSettings();
  return (
    <main className="wrap">
      <div className="auth card form">
        <h1>Pay {fmtMoney(o.total)}</h1>
        <p className="muted">Order {o.order_no}. Your items are held for {s.payment_timeout_min} minutes.</p>
        <Flash sp={sp} />
        {o.payment_status === 'paid' ? <p>Already paid.</p> : (
          <>
            <div className="demo-box">Test mode: the payment gateway is not connected yet. Choose an outcome to simulate.</div>
            <form action={payTestMode} className="stack">
              <input type="hidden" name="order_no" value={o.order_no} />
              <button className="btn btn-block btn-warm" name="outcome" value="ok">Simulate successful UPI payment</button>
              <button className="btn btn-block btn-ghost" name="outcome" value="fail">Simulate failed payment</button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
