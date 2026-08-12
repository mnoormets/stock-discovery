import { pool } from '../../src/lib/db';

// Fixture'id kirjutavad OTSE SQL-iga, mitte rakenduse abifunktsioonidega.
// Kaks põhjust:
//   1. Sõltumatus — fixture ei tohi katkeda testitava koodi vea tõttu.
//   2. src/lib/db.ts `insertPriceSnapshot` (read 79-94) sisaldab 5-minutilist
//      dedupe'i, mis neelaks fixture'i read vaikselt alla ja test mõõdaks
//      hoopis midagi muud.

export interface CompanyOptions {
  name?: string;
  // `quote_type = 'ETF'` välistatakse enrichment-universumist
  // (company-financials.ts:558). Vaikimisi NULL, mis läbib filtri.
  quoteType?: string | null;
}

export async function insertCompany(
  ticker: string,
  options: CompanyOptions = {},
): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO companies (ticker, name, source, quote_type)
     VALUES ($1, $2, 'test', $3) RETURNING id`,
    [ticker, options.name ?? `${ticker} Inc.`, options.quoteType ?? null],
  );
  return Number(rows[0].id);
}
