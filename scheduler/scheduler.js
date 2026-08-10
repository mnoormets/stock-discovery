import cron from 'node-cron';

// Ajastatud kogumine: kutsub iga päev rakenduse /api/collect endpointi.
// Ajakava ja URL tulevad keskkonnamuutujatest (vt docker-compose.yml).
const SCHEDULE = process.env.CRON_SCHEDULE || '0 8 * * *';
const URL = process.env.COLLECT_URL || 'http://app:3000/api/collect';

async function collect() {
  const stamp = new Date().toISOString();
  try {
    const res = await fetch(URL, { method: 'POST' });
    const data = await res.json();
    console.log(`[${stamp}] Kogumine:`, JSON.stringify(data));
  } catch (err) {
    console.error(`[${stamp}] Kogumine ebaõnnestus:`, err.message);
  }
}

console.log(`Scheduler käivitus. Ajakava: "${SCHEDULE}", URL: ${URL}`);
cron.schedule(SCHEDULE, collect, { timezone: process.env.TZ || 'Europe/Tallinn' });

// Ära käivita kohe stardil (app võib alles üles tulla) — jäta ainult ajakavale.
