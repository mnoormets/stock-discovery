import { pool, ensureSchema } from './db';
import type { PortfolioPosition, PositionStatus } from './investment';
import { normalizeTicker } from './investment';

function mapPosition(row: any): PortfolioPosition {
  return {
    id: Number(row.id),
    ticker: row.ticker,
    quantity: Number(row.quantity),
    averageBuyPrice: Number(row.average_buy_price),
    status: row.status,
    notes: row.notes || '',
    thesis: row.thesis || '',
    timeHorizon: row.time_horizon || '',
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listPositions(): Promise<PortfolioPosition[]> {
  await ensureSchema();
  const { rows } = await pool.query(`
    SELECT p.*, t.thesis, t.time_horizon
    FROM portfolio_positions p
    LEFT JOIN investment_theses t ON t.position_id = p.id AND t.is_current = true
    ORDER BY CASE p.status WHEN 'active' THEN 1 WHEN 'watch' THEN 2 ELSE 3 END, p.ticker
  `);
  return rows.map(mapPosition);
}

export interface PositionInput {
  ticker: string;
  quantity: number;
  averageBuyPrice: number;
  thesis: string;
  timeHorizon: string;
  status: PositionStatus;
  notes: string;
}

export function validatePosition(input: PositionInput): string | null {
  if (!normalizeTicker(input.ticker)) return 'Ticker ei ole korrektses vormingus.';
  if (!Number.isFinite(input.quantity) || input.quantity < 0) return 'Kogus peab olema null või positiivne arv.';
  if (!Number.isFinite(input.averageBuyPrice) || input.averageBuyPrice < 0) return 'Keskmine ostuhind peab olema null või positiivne arv.';
  if (!['active', 'watch', 'closed'].includes(input.status)) return 'Positsiooni staatus ei ole lubatud.';
  if (input.thesis.length > 5000 || input.notes.length > 5000 || input.timeHorizon.length > 200) return 'Sisestatud tekst on liiga pikk.';
  return null;
}

export async function createPosition(input: PositionInput): Promise<void> {
  const error = validatePosition(input);
  if (error) throw new Error(error);
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ticker = normalizeTicker(input.ticker)!;
    const company = await client.query(
      `INSERT INTO companies (ticker, source) VALUES ($1, 'portfolio')
       ON CONFLICT (ticker) DO UPDATE SET updated_at = now() RETURNING id`,
      [ticker],
    );
    const position = await client.query(
      `INSERT INTO portfolio_positions
       (company_id, ticker, quantity, average_buy_price, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [company.rows[0].id, ticker, input.quantity, input.averageBuyPrice, input.status, input.notes || null],
    );
    if (input.thesis || input.timeHorizon) {
      await client.query(
        `INSERT INTO investment_theses (position_id, thesis, time_horizon) VALUES ($1,$2,$3)`,
        [position.rows[0].id, input.thesis || 'Tees pole veel kirjeldatud.', input.timeHorizon || null],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePosition(id: number, input: PositionInput): Promise<void> {
  const error = validatePosition(input);
  if (error) throw new Error(error);
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT p.ticker, t.thesis FROM portfolio_positions p
       LEFT JOIN investment_theses t ON t.position_id=p.id AND t.is_current=true WHERE p.id=$1`,
      [id],
    );
    if (!current.rowCount) throw new Error('Positsiooni ei leitud.');
    const ticker = normalizeTicker(input.ticker)!;
    const company = await client.query(
      `INSERT INTO companies (ticker, source) VALUES ($1, 'portfolio')
       ON CONFLICT (ticker) DO UPDATE SET updated_at=now() RETURNING id`,
      [ticker],
    );
    await client.query(
      `UPDATE portfolio_positions SET company_id=$1,ticker=$2,quantity=$3,average_buy_price=$4,
       status=$5,notes=$6,updated_at=now() WHERE id=$7`,
      [company.rows[0].id, ticker, input.quantity, input.averageBuyPrice, input.status, input.notes || null, id],
    );
    if ((current.rows[0].thesis || '') !== input.thesis) {
      await client.query(`UPDATE investment_theses SET is_current=false WHERE position_id=$1 AND is_current=true`, [id]);
      if (input.thesis || input.timeHorizon) {
        await client.query(
          `INSERT INTO investment_theses (position_id, thesis, time_horizon) VALUES ($1,$2,$3)`,
          [id, input.thesis || 'Tees pole veel kirjeldatud.', input.timeHorizon || null],
        );
      }
      await client.query(
        `INSERT INTO thesis_change_events (position_id, previous_thesis, new_thesis, change_reason)
         VALUES ($1,$2,$3,'Kasutaja uuendas positsiooni')`,
        [id, current.rows[0].thesis || null, input.thesis || null],
      );
    } else {
      await client.query(`UPDATE investment_theses SET time_horizon=$2 WHERE position_id=$1 AND is_current=true`, [id, input.timeHorizon || null]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deletePosition(id: number): Promise<void> {
  await ensureSchema();
  await pool.query('DELETE FROM portfolio_positions WHERE id=$1', [id]);
}
