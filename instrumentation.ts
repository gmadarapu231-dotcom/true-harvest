// Starts the background job loop once per server process.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.DISABLE_JOBS === '1') return;
  const { runJobs } = await import('./lib/jobs');
  const tick = () => runJobs().catch((e) => console.error('[jobs]', e));
  setTimeout(tick, 5_000);
  setInterval(tick, 60_000);
}
