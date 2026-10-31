import { GEO } from '@/lib/geo';

/** <option>s for every district, grouped by state. Values are always the English name. */
export default function DistrictOptions({ te = false }: { te?: boolean }) {
  return GEO.map((s) => (
    <optgroup key={s.state} label={te ? s.te : s.state}>
      {s.districts.map((d) => <option key={d.name} value={d.name}>{te ? d.te : d.name}</option>)}
    </optgroup>
  ));
}
