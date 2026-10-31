import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GEO, ALL_DISTRICTS, districtInfo, isMandal } from '../lib/geo';

test('both states carry their current districts, each with mandals and a Telugu name', () => {
  const count = (s: string) => GEO.find((g) => g.state === s)!.districts.length;
  assert.equal(count('Telangana'), 33);
  assert.equal(count('Andhra Pradesh'), 28);
  assert.equal(new Set(ALL_DISTRICTS).size, ALL_DISTRICTS.length);
  for (const s of GEO) for (const d of s.districts) {
    assert.ok(d.mandals.length > 0, d.name);
    assert.match(d.te, /[ఀ-౿]/, d.name);
    assert.equal(new Set(d.mandals).size, d.mandals.length, d.name);
  }
  assert.equal(districtInfo('Polavaram')?.state, 'Andhra Pradesh');
  assert.ok(isMandal('Hanumakonda', 'Elkathurthy'));
  assert.ok(!isMandal('Hanumakonda', 'Nuzvid'));
});
