'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

type Opt = { value: string; label: string };
/** Page title with the mockup's filter row: period, state, channel, crop, district, and the export menu. Filters live in the URL. */
export default function FinanceHeader({ title, sub, months, districts, crops, exportReport, filters = true }: {
  title: string; sub?: ReactNode; months: Opt[]; districts: string[]; crops: string[]; exportReport?: string; filters?: boolean;
}) {
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  const set = (k: string, v: string) => {
    const q = new URLSearchParams(sp.toString());
    if (v) q.set(k, v); else q.delete(k);
    q.delete('ok'); q.delete('error'); q.delete('m');
    router.push(`${path}?${q.toString()}`);
  };
  const val = (k: string) => sp.get(k) ?? '';
  const exportQs = new URLSearchParams([...sp.entries()].filter(([k]) => ['p', 'st', 'ch', 'crop', 'd'].includes(k)));
  if (exportReport) exportQs.set('report', exportReport);
  return (
    <div className="fin-head">
      <div><h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div>
      <div className="fin-filters">
        {filters && <>
          <select aria-label="Date range" value={val('p') || val('m') || 'last30'} onChange={(e) => set('p', e.target.value)}>
            {months.map((m) => <option key={m.value} value={m.value}>Date: {m.label}</option>)}
          </select>
          <select aria-label="State" value={val('st')} onChange={(e) => set('st', e.target.value)}>
            <option value="">State: AP &amp; Telangana</option><option value="Telangana">State: Telangana</option><option value="Andhra Pradesh">State: Andhra Pradesh</option>
          </select>
          <select aria-label="District" value={val('d')} onChange={(e) => set('d', e.target.value)}>
            <option value="">District: All</option>{districts.map((d) => <option key={d} value={d}>District: {d}</option>)}
          </select>
          <select aria-label="Channel" value={val('ch')} onChange={(e) => set('ch', e.target.value)}>
            <option value="">Channel: All (B2C/B2B)</option><option value="b2c">Channel: Households (B2C)</option><option value="b2b">Channel: Businesses (B2B)</option>
          </select>
          <select aria-label="Crop" value={val('crop')} onChange={(e) => set('crop', e.target.value)}>
            <option value="">Crop: All crops</option>{crops.map((c) => <option key={c} value={c}>Crop: {c}</option>)}
          </select>
        </>}
        <details className="fin-export">
          <summary>Export as PDF/Excel ▾</summary>
          <div className="menu">
            {exportReport && <a href={`/admin/finance/export?${exportQs.toString()}`}>Download CSV (opens in Excel)</a>}
            <button type="button" onClick={() => window.print()}>Print or save as PDF</button>
          </div>
        </details>
      </div>
    </div>
  );
}
