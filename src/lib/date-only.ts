/**
 * PostgreSQL DATE võib pg kliendist tulla kas Date objektina või stringina.
 * Hoidkem DATE semantika andmekihi piiril, et UI ei prooviks lokaliseeritud
 * `Sat Aug 15 ...` stringile kellaaega külge liita.
 *
 * F1 (investigation/postgresql-date-timezone-audit.md): Date-haru kasutas varem
 * `toISOString()`-i, mis nihutas kuupäeva päeva võrra tagasi igas positiivse
 * UTC-nihkega ajavööndis. Põhjus: pg-types parsib DATE (typeId 1082)
 * **lokaalseks kesköökes**, mitte UTC kesköökes. Europe/Tallinnas (UTC+3) sai
 * DATE '2026-08-19' Date objektiks 2026-08-18T21:00:00Z, mille
 * `toISOString().slice(0, 10)` andis '2026-08-18'.
 *
 * Seetõttu loetakse Date objektilt kalendripäev LOKAALSETE akcessoritega:
 * pg konstrueerib väärtuse ja me loeme selle samast lokaalsest raamist, seega
 * need taanduvad ja tulemus on ajavööndist sõltumatu. Mõõdetud kuues tsoonis
 * (UTC, Europe/Tallinn, America/New_York, Asia/Tokyo, Pacific/Kiritimati,
 * America/Sao_Paulo): lokaalsed akcessorid 3/3 õiged kõigis, `toISOString()` ja
 * `getUTC*` mõlemad valed igas positiivse nihkega tsoonis.
 */
function localDateOnly(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function toDateOnly(value: unknown): string {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error('Vigane DATE väärtus.');
    return localDateOnly(value);
  }

  const text = String(value ?? '').trim();
  const exact = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  if (exact) return exact[1];

  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Vigane DATE väärtus: ${text || '(tühi)'}`);
  return localDateOnly(parsed);
}

