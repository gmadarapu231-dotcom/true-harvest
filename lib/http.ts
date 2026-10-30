import { redirect } from 'next/navigation';

/** Run a mutation and report a readable error instead of crashing the page. Database errors stay generic. */
export async function attempt(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e: any) {
    if (typeof e?.digest === 'string' && e.digest.startsWith('NEXT_')) throw e; // let redirect()/notFound() through
    if (e?.code || e?.severity) {
      console.error(e);
      return 'Something went wrong. Please try again.';
    }
    return e?.message || 'Something went wrong.';
  }
}

export function back(path: string, err: string | null, ok?: string): never {
  const sep = path.includes('?') ? '&' : '?';
  if (err) redirect(`${path}${sep}error=${encodeURIComponent(err)}`);
  redirect(ok ? `${path}${sep}ok=${encodeURIComponent(ok)}` : path);
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
export const num = (fd: FormData, k: string) => {
  const v = parseFloat(str(fd, k));
  return Number.isFinite(v) ? v : NaN;
};
export const int = (fd: FormData, k: string) => parseInt(str(fd, k), 10);
