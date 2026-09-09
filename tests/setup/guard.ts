import { afterAll } from 'vitest';
import { TEST_DATABASE_URL, assertTestDatabaseName, redact } from './test-db-url';

// Vitest setupFiles: jookseb igas worker-protsessis ENNE vastava testifaili
// importimist. See on turvakaitse süda.
//
// K1 — src/lib/db.ts loob `pool`-i impordi hetkel (`db.ts:9-16`) ja cache'ib
// selle globalThis peale. Kui DATABASE_URL ei ole enne importi seatud, langeb
// see vaikeväärtusele `db:5432/discovery` ehk TOOTMISELE. Seega env seatakse
// siin, enne igat lib-importi.

assertTestDatabaseName();
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.DATABASE_TARGET = 'test';

// Dünaamiline import, sest ESM staatilised importid hoisti'takse mooduli algusse
// ja tooksid db.ts sisse enne ülemist rida.
const { pool } = await import('../../src/lib/db');

// K2 — runtime-tõend. Ei usalda URL-stringi parsimist, vaid küsib andmebaasilt
// endalt, kuhu ühendus päriselt läks. See on ainuke kontroll, mis tõestab
// tegeliku ühenduse, mitte kavatsuse.
const { rows } = await pool.query('SELECT current_database() AS db');
const connected = String(rows[0].db);
if (connected === 'discovery' || !connected.endsWith('_test')) {
  throw new Error(
    `KEELATUD: testid on ühendatud andmebaasiga "${connected}". `
    + `Oodati "_test"-lõpulist nime. URL: ${redact(TEST_DATABASE_URL)}`,
  );
}

// Iga testifail saab forks-poolis oma protsessi ja seega oma Pool'i. Sulgeme
// selle faili lõpus, muidu Vitest ripub avatud handle'ite tõttu.
afterAll(async () => {
  await pool.end();
});
