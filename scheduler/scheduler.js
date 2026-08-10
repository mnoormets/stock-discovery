import cron from 'node-cron';

const SCHEDULE = process.env.CRON_SCHEDULE || '0 8 * * *';
const URL = process.env.COLLECT_URL || 'http://app:3000/api/collect';
const SECRET = process.env.CRON_SECRET || '';

async function collect() {
  const stamp = new Date().toISOString();
  try {
    if (!SECRET) throw new Error('CRON_SECRET puudub');
    const res = await fetch(URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    console.log(`[${stamp}] Kogumine:`, JSON.stringify(data));
  } catch (err) {
    console.error(`[${stamp}] Kogumine ebaõnnestus:`, err.message);
  }
}

console.log(`Ajastaja käivitus. Ajakava: "${SCHEDULE}", URL: ${URL}`);
cron.schedule(SCHEDULE, collect, { timezone: process.env.TZ || 'Europe/Tallinn' });
