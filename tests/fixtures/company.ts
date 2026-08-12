import { pool } from '../../src/lib/db';

// Fixture'id kirjutavad OTSE SQL-iga, mitte rakenduse abifunktsioonidega.
// Kaks põhjust:
//   1. Sõltumatus — fixture ei tohi katkeda testitava koodi vea tõttu.
//   2. src/lib/db.ts `insertPriceSnapshot` (read 79-94) sisaldab 5-minutilist
//      dedupe'i, mis neelaks fixture'i read vaikselt alla ja test mõõdaks
//      hoopis midagi muud.

export async function insertCompany(ticker: string, name?: string): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO companies (ticker, name, source) VALUES ($1, $2, 'test') RETURNING id`,
    [ticker, name ?? `${ticker} Inc.`],
  );
  return Number(rows[0].id);
}
