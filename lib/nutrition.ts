// Approximate nutrients per 100 g edible portion (Indian Food Composition Tables 2017, USDA FoodData Central where IFCT
// is silent). Good enough to compare vegetables and plan a week's box; not a clinical tool.
//   p protein g · f fibre g · c vitamin C mg · a vitamin A µg RAE · fe iron mg · fol folate µg · kcal
export interface Nutrients { p: number; f: number; c: number; a: number; fe: number; fol: number; kcal: number }
const n = (p: number, f: number, c: number, a: number, fe: number, fol: number, kcal: number): Nutrients => ({ p, f, c, a, fe, fol, kcal });

export const NUTRIENTS: Record<string, Nutrients> = {
  // Fruits
  Banana: n(1.1, 2.6, 9, 3, 0.3, 20, 89), Guava: n(2.6, 5.4, 228, 31, 0.3, 49, 68), Mango: n(0.8, 1.6, 36, 54, 0.2, 43, 60),
  Papaya: n(0.5, 1.7, 61, 47, 0.3, 37, 43), Pomegranate: n(1.7, 4, 10, 0, 0.3, 38, 83), 'Sweet orange': n(0.9, 2.4, 53, 11, 0.1, 30, 47),
  Watermelon: n(0.6, 0.4, 8, 28, 0.2, 3, 30),
  // Grains and pulses (dry weight)
  Jowar: n(10.4, 9.7, 0, 0, 3.9, 39, 334), Maize: n(9.4, 7.3, 0, 11, 2.7, 19, 365), 'Sona Masoori rice': n(6.8, 0.6, 0, 0, 0.7, 9, 350),
  'Green gram': n(24, 16, 5, 6, 6.7, 625, 347), 'Red gram': n(22, 15, 0, 0, 5.2, 456, 343),
  // Leafy greens
  Amaranth: n(2.5, 2.1, 43, 146, 2.9, 85, 23), Coriander: n(2.1, 2.8, 27, 337, 1.8, 62, 23), 'Curry leaves': n(6.1, 6.4, 4, 600, 0.9, 23, 108),
  'Dill leaves': n(3.5, 2.1, 85, 386, 6.6, 150, 43), 'Fenugreek leaves': n(4.4, 4.9, 52, 395, 1.9, 57, 49), Gongura: n(1.7, 2.5, 20, 230, 2.3, 40, 56),
  'Malabar spinach': n(1.8, 2, 102, 400, 1.2, 140, 19), Mint: n(3.8, 8, 32, 212, 5, 114, 70), Ponnaganti: n(5, 2.8, 17, 300, 1.6, 40, 73),
  Spinach: n(2.9, 2.2, 28, 469, 2.7, 194, 23),
  // Vegetables
  'Ash gourd': n(0.4, 2.9, 13, 0, 0.4, 5, 13), Beetroot: n(1.6, 2.8, 5, 2, 0.8, 109, 43), 'Bitter gourd': n(1, 2.8, 84, 24, 0.4, 72, 17),
  'Bottle gourd': n(0.6, 0.5, 10, 1, 0.2, 6, 14), Brinjal: n(1, 3, 2, 1, 0.2, 22, 25), 'Broad beans': n(4, 3, 20, 10, 1.3, 60, 48),
  Cabbage: n(1.3, 2.5, 36, 5, 0.5, 43, 25), Capsicum: n(1, 1.7, 80, 18, 0.3, 10, 20), Carrot: n(0.9, 2.8, 6, 835, 0.3, 19, 41),
  Cauliflower: n(1.9, 2, 48, 0, 0.4, 57, 25), 'Cluster beans': n(3.2, 3.2, 49, 20, 1.1, 50, 16), Colocasia: n(1.5, 4.1, 5, 4, 0.6, 22, 112),
  Cucumber: n(0.7, 0.5, 3, 5, 0.3, 7, 15), Drumstick: n(2.1, 3.2, 141, 4, 0.4, 44, 37), 'Elephant foot yam': n(1.5, 4, 1, 2, 0.6, 20, 97),
  'French beans': n(1.8, 2.7, 12, 35, 1, 33, 31), Garlic: n(6.4, 2.1, 31, 0, 1.7, 3, 149), Ginger: n(1.8, 2, 5, 0, 0.6, 11, 80),
  'Green chilli': n(2, 1.5, 144, 48, 1, 23, 40), 'Green peas': n(5.4, 5.7, 40, 38, 1.5, 65, 81), 'Ivy gourd': n(1.2, 1.6, 5, 15, 0.4, 20, 18),
  Tindora: n(1.2, 1.6, 5, 15, 0.4, 20, 18), Lemon: n(1.1, 2.8, 53, 1, 0.6, 11, 29), Okra: n(1.9, 3.2, 23, 36, 0.6, 60, 33),
  Onion: n(1.1, 1.7, 7, 0, 0.2, 19, 40), Potato: n(2, 2.2, 20, 0, 0.8, 15, 77), Pumpkin: n(1, 0.5, 9, 426, 0.8, 16, 26),
  Radish: n(0.7, 1.6, 15, 0, 0.3, 25, 16), 'Raw banana': n(1.3, 2.3, 18, 5, 0.6, 22, 122), 'Ridge gourd': n(0.5, 0.5, 5, 20, 0.4, 7, 20),
  'Snake gourd': n(0.5, 0.8, 18, 10, 0.3, 12, 18), 'Spring onion': n(1.8, 2.6, 19, 50, 1.5, 64, 32), 'Sweet corn': n(3.3, 2.7, 7, 9, 0.5, 42, 86),
  'Sweet potato': n(1.6, 3, 2, 709, 0.6, 11, 86), Tomato: n(0.9, 1.2, 14, 42, 0.3, 15, 18),
};

// Daily needs, averaged over men and women (ICMR-NIN Recommended Dietary Allowances 2020, sedentary adults); children 7 to 12.
export const TARGETS = {
  adult: { p: 50, f: 30, c: 72, a: 920, fe: 24, fol: 300 },
  child: { p: 28, f: 22, c: 50, a: 600, fe: 16, fol: 220 },
} as const;
export type NutrientKey = keyof typeof TARGETS.adult;
export const NUTRIENT_LABELS: Record<NutrientKey, { en: string; te: string; unit: string }> = {
  p: { en: 'Protein', te: 'ప్రోటీన్', unit: 'g' }, f: { en: 'Fibre', te: 'పీచు', unit: 'g' }, c: { en: 'Vitamin C', te: 'విటమిన్ సి', unit: 'mg' },
  a: { en: 'Vitamin A', te: 'విటమిన్ ఎ', unit: 'µg' }, fe: { en: 'Iron', te: 'ఇనుము', unit: 'mg' }, fol: { en: 'Folate', te: 'ఫోలేట్', unit: 'µg' },
};

export const GOALS: Record<string, { en: string; te: string; weights: Partial<Record<NutrientKey, number>>; note: string }> = {
  balanced: { en: 'Balanced', te: 'సమతుల్యం', weights: { p: 1, f: 1, c: 1, a: 1, fe: 1, fol: 1 }, note: 'A spread of colours: greens, a root, a gourd and seasonal fruit.' },
  protein: { en: 'More protein', te: 'ఎక్కువ ప్రోటీన్', weights: { p: 3, fe: 1, f: 1 }, note: 'Dal, peas and beans lead. Vegetables alone cannot meet protein: add milk, curd, eggs or paneer as you eat them.' },
  iron: { en: 'Iron and folate', te: 'ఇనుము, ఫోలేట్', weights: { fe: 3, fol: 2, c: 1 }, note: 'Greens and dal for iron, with a vitamin C food (lemon, guava, tomato) in the same meal to help absorb it.' },
  immunity: { en: 'Vitamins A and C', te: 'విటమిన్లు ఎ, సి', weights: { c: 2, a: 2, fol: 1 }, note: 'Bright colours: carrot, pumpkin, greens, guava, papaya and capsicum.' },
  diabetes: { en: 'Low sugar, high fibre', te: 'తక్కువ చక్కెర', weights: { f: 3, p: 1, c: 1 }, note: 'High-fibre vegetables and dal; starchy roots and sweet fruit are left out. Follow your doctor’s advice first.' },
};
// Left out of the diabetes plan, and never picked as a daily vegetable: starchy or used in small amounts as seasoning.
const STARCHY = new Set(['Potato', 'Raw banana', 'Colocasia', 'Elephant foot yam', 'Sweet potato', 'Sweet corn', 'Banana', 'Mango', 'Watermelon']);
const SEASONING = new Set(['Garlic', 'Ginger', 'Green chilli', 'Lemon', 'Curry leaves', 'Coriander', 'Mint', 'Dry red chilli', 'Turmeric']);

export interface Household { adults: number; kids: number; goal: string; exclude?: string[] }
export interface Offer { crop: string; crop_te?: string; category: string; price_per_kg: number; listing_id?: number; farmer_id?: number; emoji?: string }
export interface PlanItem extends Offer { grams: number; why: string }
export interface DayPlan { items: PlanItem[]; totals: Nutrients; needs: Record<NutrientKey, number>; costPerDay: number; note: string }

const KEYS: NutrientKey[] = ['p', 'f', 'c', 'a', 'fe', 'fol'];

/** Daily needs for the household. */
export function needsFor(h: Household): Record<NutrientKey, number> {
  return Object.fromEntries(KEYS.map((k) => [k, h.adults * TARGETS.adult[k] + h.kids * TARGETS.child[k]])) as Record<NutrientKey, number>;
}

/** How much of the household's daily need 100 g covers, weighted by the goal, per rupee spent (price counts lightly). */
function score(o: Offer, goal: string, need: Record<NutrientKey, number>) {
  const nu = NUTRIENTS[o.crop]; if (!nu) return 0;
  const w = (GOALS[goal] ?? GOALS.balanced).weights;
  const value = KEYS.reduce((s, k) => s + (w[k] ?? 0) * (nu[k] / need[k]), 0);
  return value / Math.sqrt(Math.max(o.price_per_kg, 10) / 10);
}

const strongest = (crop: string) => {
  const nu = NUTRIENTS[crop]; if (!nu) return '';
  const share = KEYS.map((k) => [k, nu[k] / TARGETS.adult[k]] as const).sort((x, y) => y[1] - x[1]);
  return share.slice(0, 2).map(([k]) => NUTRIENT_LABELS[k].en.toLowerCase()).join(' and ');
};

/**
 * One day's vegetables, greens, fruit and dal for the household from what is on sale today. Portions follow the
 * ICMR-NIN 2024 dietary guidelines: about 400 g of vegetables (a quarter of it greens), 100 g of fruit and 60 g of dal
 * per adult, less for children. Picks the best-scoring items per group for the goal, one of each kind per group.
 */
export function planDay(h: Household, offers: Offer[]): DayPlan {
  const need = needsFor(h);
  const goal = GOALS[h.goal] ? h.goal : 'balanced';
  const ex = new Set(h.exclude ?? []);
  // Cheapest offer per crop; seasoning and spices are left to the cook.
  const best = new Map<string, Offer>();
  for (const o of offers) {
    if (ex.has(o.crop) || SEASONING.has(o.crop) || !NUTRIENTS[o.crop] || o.category === 'spices' || o.category === 'grains') continue;
    if (goal === 'diabetes' && STARCHY.has(o.crop)) continue;
    const cur = best.get(o.crop); if (!cur || o.price_per_kg < cur.price_per_kg) best.set(o.crop, o);
  }
  const pick = (cat: (o: Offer) => boolean, count: number) =>
    [...best.values()].filter(cat).sort((x, y) => score(y, goal, need) - score(x, goal, need)).slice(0, count);
  const people = h.adults + 0.6 * h.kids;
  const groups: [Offer[], number][] = [
    [pick((o) => o.category === 'leafy', 2), 100 * people],
    [pick((o) => o.category === 'vegetables' && !STARCHY.has(o.crop), 3), 300 * people],
    [pick((o) => o.category === 'fruits', 1), 100 * people],
    [pick((o) => o.category === 'pulses', goal === 'protein' ? 2 : 1), (goal === 'protein' ? 90 : 60) * people],
  ];
  const items: PlanItem[] = [];
  for (const [chosen, grams] of groups) {
    for (const o of chosen) items.push({ ...o, grams: Math.round(grams / chosen.length / 25) * 25 || 25, why: `rich in ${strongest(o.crop)}` });
  }
  const totals = items.reduce((t, i) => {
    const nu = NUTRIENTS[i.crop];
    for (const k of [...KEYS, 'kcal'] as (keyof Nutrients)[]) t[k] += (nu[k] * i.grams) / 100;
    return t;
  }, n(0, 0, 0, 0, 0, 0, 0));
  const costPerDay = Math.round(items.reduce((s, i) => s + (i.price_per_kg * i.grams) / 1000, 0));
  return { items, totals, needs: need, costPerDay, note: GOALS[goal].note };
}

/** Share of each daily need the plan covers, 0 to 1+. */
export const coverage = (p: DayPlan) => Object.fromEntries(KEYS.map((k) => [k, p.totals[k] / p.needs[k]])) as Record<NutrientKey, number>;
export { KEYS as NUTRIENT_KEYS };
