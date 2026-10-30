'use client';
import { useState } from 'react';

// Shows the farmer what they keep per kg before publishing (R-4.7).
export default function PayoutPreview({ b2c, b2b, defaultPrice, defaultB2b }: { b2c: number; b2b: number; defaultPrice?: number; defaultB2b?: number | null }) {
  const [p, setP] = useState(defaultPrice ? String(defaultPrice) : '');
  const [bp, setBp] = useState(defaultB2b ? String(defaultB2b) : '');
  const price = parseFloat(p) || 0;
  const bulk = parseFloat(bp) || 0;
  const r = (n: number) => `₹${n.toFixed(2)}`;
  return (
    <>
      <div className="grid2">
        <label>Price per kg (₹) / కిలో ధర
          <input name="price_per_kg" inputMode="decimal" required value={p} onChange={(e) => setP(e.target.value)} />
        </label>
        <label>Wholesale price per kg (₹, optional) / హోల్‌సేల్ ధర
          <input name="b2b_price_per_kg" inputMode="decimal" value={bp} onChange={(e) => setBp(e.target.value)} />
        </label>
      </div>
      {price > 0 && (
        <p className="payout-note">
          You receive about <b>{r(price * (1 - b2c))}</b> per kg from households after {Math.round(b2c * 1000) / 10}% commission
          {bulk > 0 ? <> and <b>{r(bulk * (1 - b2b))}</b> per kg from businesses after {Math.round(b2b * 1000) / 10}%</> : null}.
          Delivery and packing fees are paid by the buyer.
        </p>
      )}
    </>
  );
}
