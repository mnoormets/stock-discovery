/**
 * PostgreSQL DATE võib pg kliendist tulla kas Date objektina või stringina.
 * Hoidkem DATE semantika andmekihi piiril, et UI ei prooviks lokaliseeritud
 * `Sat Aug 15 ...` stringile kellaaega külge liita.
 * 
 * DATE väärtusi käsitletakse kalendripäevadena ilma ajavööndi teisendusteta.
 */
export function toDateOnly(value: unknown): string {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error('Vigane DATE väärtus.');
    // Ekstrahime kalendripäeva komponendid lokaalsest ajast, et vältida
    // ajavööndi nihet (nt Europe/Tallinn vs UTC).
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  const text = String(value ?? '').trim();
  const exact = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  if (exact) return exact[1];
  
  // Handle empty/null/undefined cases before parsing
  if (!text) return '';

  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Vigane DATE väärtus: ${text}`);
  // Kasutame sama lokaalset ekstrakteerimist nagu Date objekti puhul.
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
