import Anthropic from '@anthropic-ai/sdk';
import { GOALS, NUTRIENT_LABELS, NUTRIENT_KEYS, coverage, type DayPlan, type Household } from './nutrition';

// The nutrition assistant. Answers a household's question with today's plan and today's stock as context. Runs only
// when ANTHROPIC_API_KEY is set; without it the app still shows the rule-based plan from lib/nutrition.ts.
export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

const SYSTEM = `You are the TrueHarvest nutrition assistant, helping Indian households in Telangana and Andhra Pradesh plan daily vegetables, greens, fruit and dal from what local farmers sell today.
- Base suggestions on the household, its goal, today's plan and today's prices given in the message. Prefer items on sale today and say their price per kg when useful.
- Use Indian dishes and Telugu home cooking (pappu, koora, pachadi, rasam) for ideas. Give Telugu names in brackets where you know them.
- Be honest about protein: vegetables give little; dal, peas, beans, milk, curd, eggs, fish or meat carry it. Respect a vegetarian household if the question says so.
- Keep to general healthy-eating guidance (ICMR-NIN). Do not diagnose or prescribe. For pregnancy, diabetes, kidney disease, allergies or medication, say to follow their doctor or dietitian.
- Answer in the language of the question (Telugu or English), in under 180 words, with short lines a phone screen can show.`;

function context(h: Household, plan: DayPlan) {
  const cov = coverage(plan);
  return [
    `Household: ${h.adults} adult(s), ${h.kids} child(ren). Goal: ${(GOALS[h.goal] ?? GOALS.balanced).en}.`,
    `Today's plan per day: ${plan.items.map((i) => `${i.crop} ${i.grams} g at ₹${i.price_per_kg}/kg`).join('; ')}. About ₹${plan.costPerDay} a day.`,
    `Share of daily needs this plan covers: ${NUTRIENT_KEYS.map((k) => `${NUTRIENT_LABELS[k].en} ${Math.round(cov[k] * 100)}%`).join(', ')}.`,
  ].join('\n');
}

export async function askNutritionist(question: string, h: Household, plan: DayPlan, onSale: string[]): Promise<string> {
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: SYSTEM,
    messages: [{ role: 'user', content: `${context(h, plan)}\nOn sale today: ${onSale.join(', ')}.\n\nQuestion: ${question}` }],
  });
  if (response.stop_reason === 'refusal') return 'Sorry, I can’t help with that question. For medical advice, please ask your doctor or a dietitian.';
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim();
  return text || 'Sorry, I could not answer that just now. Please try again.';
}
