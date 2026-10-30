import { requireUser } from './auth';
import { getLang, translator } from './i18n';
import { one } from './db';

export async function farmerContext() {
  const u = await requireUser('farmer');
  const lang = await getLang(u.lang);
  const fp = (await one('SELECT * FROM farmer_profiles WHERE user_id=$1', [u.id]))!;
  return { u, lang, t: translator(lang), fp };
}
