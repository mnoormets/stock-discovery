/**
 * PostgreSQL DATE võib pg kliendist tulla kas Date objektina või stringina.
 * Hoidkem DATE semantika andmekihi piiril, et UI ei prooviks lokaliseeritud
 * `Sat Aug 15 ...` stringile kellaaega külge liita.
 */
export function toDateOnly(value: unknown): string {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error('Vigane DATE väärtus.');
    return value.toISOString().slice(0, 10);
  }

  const text = String(value ?? '').trim();
  const exact = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  if (exact) return exact[1];

  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Vigane DATE väärtus: ${text || '(tühi)'}`);
  return parsed.toISOString().slice(0, 10);
}

