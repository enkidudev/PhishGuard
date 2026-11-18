export async function register() {
 if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.VERCEL !== '1') {
  const { purgeExpired } = await import('./lib/retention')
  const run = () => void purgeExpired().catch(() => console.error('Retention sweep failed; will retry on next interval'))
  run()
  const timer = setInterval(run, 60_000)
  timer.unref()
 }
}
