// Genereerib loetava päevaaruande (markdown) DB-ridadest.

function fmtCap(cap: number | null): string {
  if (!cap) return 'teadmata';
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)} mld`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)} mln`;
  return `$${cap}`;
}

function fmtGrowth(g: number | null): string {
  if (g == null) return 'uus';
  const pct = Math.round(g * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

function sentimentLabel(row: any): string {
  const src = row.sentiment_source === 'tradestie'
    ? 'Tradestie, usaldusväärsem'
    : 'ApeWisdom proxy, nõrgem';
  return `${row.sentiment} (${src})`;
}

export function buildReport(captureDate: string, rows: any[]): string {
  const lines: string[] = [];
  lines.push(`# Päevaaruanne — ${captureDate}`);
  lines.push('');
  lines.push('> ⚠️ Informatiivne ideede-leidmise tööriist, MITTE investeerimisnõustamine.');
  lines.push('> Väike turukap + järsk mainimiste kasv on ka pump-and-dump profiil — kontrolli ise.');
  lines.push('');

  if (rows.length === 0) {
    lines.push('_Täna leide ei olnud. Kas kogumine on käivitatud?_');
    return lines.join('\n');
  }

  lines.push(`Leiti **${rows.length}** vähemtuntud kandidaati. Top leiud:`);
  lines.push('');

  rows.forEach((r, i) => {
    const growth = fmtGrowth(r.mention_growth != null ? Number(r.mention_growth) : null);
    const newTag = r.is_new ? ' 🆕' : '';
    const capSrc = r.fundamentals_source ? ` (${r.fundamentals_source})` : '';
    lines.push(
      `### ${i + 1}. ${r.ticker} — ${r.name}${newTag}  ·  skoor ${Number(r.discovery_score).toFixed(1)}`,
    );
    lines.push(
      `Tähelepanu tõuseb: mainimised **${r.mentions}** (${growth} vs eile` +
        (r.rising_days >= 2 ? `, ${r.rising_days} päeva järjest tõusnud` : '') +
        `), sentiment **${sentimentLabel(r)}**, turukap **${fmtCap(r.market_cap ? Number(r.market_cap) : null)}**${capSrc}` +
        (r.price ? `, hind ${Number(r.price).toFixed(2)} ${r.currency ?? ''}` : '') +
        '.',
    );
    // Manipulatsiooni-hoiatused (kui on).
    let warns: string[] = [];
    try { warns = JSON.parse(r.warnings || '[]'); } catch { warns = []; }
    if (warns.length > 0) {
      warns.forEach((w) => lines.push(`- ${w}`));
    }
    lines.push('');
  });

  lines.push('---');
  lines.push('_Skoor = mainimiste kasv (max 35, tipp ~+150%) + mitmepäevane järjekindlus (max 15) + sentiment (max 25) + väiksem turukap (max 25) + uudsus (max 5), MIINUS trahvid (SEC −60, üleöö-piik −20, madal likviidsus −12)._');
  return lines.join('\n');
}
