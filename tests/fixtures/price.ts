import { pool } from '../../src/lib/db';

// Hinnasnapshot'id kirjutatakse OTSE SQL-iga. See ei ole stiilivalik:
// src/lib/db.ts `insertPriceSnapshot` (read 79-94) jätab rea vahele, kui sama
// ettevõtte kohta on viimase 5 minuti sees identne hinnarida. Fixture'is
// tähendaks see ridade vaikset kadumist ja test mõõdaks hoopis midagi muud.
//
// `captured_at` antakse alati eksplitsiitselt: outcome'ide mõõtmine sõltub
// täpsetest ajaakendest, seega DEFAULT now() teeks testid mittedeterministlikuks.

export async function insertPriceSnapshot(
  companyId: number,
  price: number,
  capturedAt: string,
  source = 'test',
  marketAt: string | null = capturedAt,
): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO price_snapshots (company_id, price, captured_at, source, market_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [companyId, price, capturedAt, source, marketAt],
  );
  return Number(rows[0].id);
}
