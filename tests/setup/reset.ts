import { pool } from '../../src/lib/db';

// Testidevaheline isolatsioon. `pool` imporditakse siin staatiliselt ohutult,
// sest reset.ts imporditakse ainult testifailidest, mis laaditakse pärast
// guard.ts-i — seega DATABASE_URL on juba test-baasi peal ja Pool cache'itud.

let cachedTables: string[] | null = null;

async function assertTestDatabase(): Promise<string> {
  const { rows } = await pool.query('SELECT current_database() AS db');
  const connected = String(rows[0].db);
  if (connected === 'discovery' || !connected.endsWith('_test')) {
    throw new Error(`KEELATUD: resetDb() keeldub andmebaasis "${connected}".`);
  }
  return connected;
}

export async function publicTables(): Promise<string[]> {
  if (cachedTables) return cachedTables;
  const { rows } = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  cachedTables = rows.map((row) => String(row.tablename));
  return cachedTables;
}

export async function resetDb(): Promise<void> {
  // Kaitse kordamine vahetult enne hävitavat operatsiooni. TRUNCATE on
  // pöördumatu, seega kontroll ei tugine ainult guard.ts-ile.
  await assertTestDatabase();
  const tables = await publicTables();
  if (tables.length === 0) return;
  const list = tables.map((table) => `"${table}"`).join(', ');
  // RESTART IDENTITY on nõutav, et ID-d oleksid testide vahel determinstlikud.
  // CASCADE hoolitseb võõrvõtmete järjekorra eest.
  await pool.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
