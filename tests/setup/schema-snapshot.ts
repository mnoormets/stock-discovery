import { pool } from '../../src/lib/db';

// Deterministlik skeemi hetktõmmis. Kasutab struktureeritud SELECT-e
// information_schema / pg_catalog pealt, MITTE pg_dump toorteksti: dump sisaldab
// mitte-deterministlikke detaile (järjekord, kommentaarid, versioonipäis).
//
// Iga päring sorteerib SQL-i poolel, seega tõmmis on stabiilne ka siis, kui
// PostgreSQL muudab sisemist ridade järjekorda.

export interface SchemaSnapshot {
  tables: string[];
  columns: string[];
  indexes: string[];
  constraints: string[];
}

const QUERIES: Record<keyof SchemaSnapshot, string> = {
  tables: `
    SELECT tablename AS item
    FROM pg_tables WHERE schemaname = 'public'
    ORDER BY 1`,

  // Tüüp, NULL-lubatavus ja default on kaasas, et ka veeru MUUTMINE (mitte
  // ainult lisandumine) tõmbaks testi punaseks.
  columns: `
    SELECT table_name || '.' || column_name || ' :: ' || data_type
           || ' :: null=' || is_nullable
           || ' :: default=' || coalesce(column_default, '-') AS item
    FROM information_schema.columns WHERE table_schema = 'public'
    ORDER BY 1`,

  indexes: `
    SELECT tablename || ' :: ' || indexdef AS item
    FROM pg_indexes WHERE schemaname = 'public'
    ORDER BY 1`,

  constraints: `
    SELECT c.conrelid::regclass::text || ' :: ' || c.contype::text
           || ' :: ' || pg_get_constraintdef(c.oid) AS item
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public'
    ORDER BY 1`,
};

export async function schemaSnapshot(): Promise<SchemaSnapshot> {
  const snapshot = {} as SchemaSnapshot;
  for (const [kind, sql] of Object.entries(QUERIES) as Array<[keyof SchemaSnapshot, string]>) {
    const { rows } = await pool.query(sql);
    snapshot[kind] = rows.map((row) => String(row.item));
  }
  return snapshot;
}

// Objektid, mis on `after`-is olemas, aga `before`-is puudusid. Kasutatakse
// assertsioonis, et ebaõnnestumise teade nimetaks TÄPSE lisandunud objekti,
// mitte ei kuvaks kahte 300-realist massiivi.
export function addedItems(before: string[], after: string[]): string[] {
  const known = new Set(before);
  return after.filter((item) => !known.has(item));
}

export function removedItems(before: string[], after: string[]): string[] {
  const known = new Set(after);
  return before.filter((item) => !known.has(item));
}
