'use client';
import { useState } from 'react';
import { GEO } from '@/lib/geo';

/** State, district and mandal pickers that narrow each other. Field names are state, district and mandal. */
export default function PlaceSelect({ te = false, state: s0 = '', district: d0 = '', mandal: m0 = '', required = true }: {
  te?: boolean; state?: string; district?: string; mandal?: string; required?: boolean;
}) {
  const start = GEO.find((s) => s.state === s0) ?? GEO.find((s) => s.districts.some((d) => d.name === d0)) ?? GEO[0];
  const [state, setState] = useState(start.state);
  const [district, setDistrict] = useState(start.districts.some((d) => d.name === d0) ? d0 : '');
  const [mandal, setMandal] = useState(m0);
  const st = GEO.find((s) => s.state === state) ?? GEO[0];
  const mandals = st.districts.find((d) => d.name === district)?.mandals ?? [];
  // Keep an older free-text mandal visible so saving the form does not silently drop it.
  const legacy = mandal && !mandals.includes(mandal) ? mandal : '';
  return (
    <div className="grid3">
      <label>{te ? 'రాష్ట్రం' : 'State'}
        <select name="state" value={state} onChange={(e) => { setState(e.target.value); setDistrict(''); setMandal(''); }}>
          {GEO.map((s) => <option key={s.state} value={s.state}>{te ? s.te : s.state}</option>)}
        </select>
      </label>
      <label>{te ? 'జిల్లా' : 'District'}
        <select name="district" value={district} required={required} onChange={(e) => { setDistrict(e.target.value); setMandal(''); }}>
          <option value="">{te ? 'ఎంచుకోండి' : 'Choose'} ({st.districts.length})</option>
          {st.districts.map((d) => <option key={d.name} value={d.name}>{te ? `${d.te} · ${d.name}` : d.name}</option>)}
        </select>
      </label>
      <label>{te ? 'మండలం' : 'Mandal'}
        <select name="mandal" value={mandal} required={required} disabled={!district} onChange={(e) => setMandal(e.target.value)}>
          <option value="">{district ? `${te ? 'ఎంచుకోండి' : 'Choose'} (${mandals.length})` : te ? 'ముందు జిల్లా' : 'Pick a district first'}</option>
          {legacy && <option value={legacy}>{legacy}</option>}
          {mandals.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
    </div>
  );
}
