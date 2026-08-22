// Read-only SEC Form 4 calibration. Fetches public EDGAR index/filing data and
// optionally reads the local companies table for overlap; it never writes DB data.
//
// Usage:
//   npm run calibrate:form4 -- --days 3 --max-filings-per-day 200
//   npm run calibrate:form4 -- --dates 2026-08-21,2026-08-20 --max-filings-per-day all
//   npm run calibrate:form4 -- --report docs/FORM4_CALIBRATION_2026-08-23.md

// The targeted XML reader deliberately extracts only the stable Ownership XML
// fields needed by this calibration. Unknown/missing values remain null.

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { loadEnv, repoRoot, registerRepoModules } = require('./_ts-loader.cjs');

const SEC_BASE = 'https://www.sec.gov';
const SEC_TIMEOUT_MS = 10_000;
const SEC_MIN_INTERVAL_MS = 200; // single-file sequence, at most 5 req/s
const DEFAULT_DAYS = 3;
const DEFAULT_MAX_FILINGS_PER_DAY = 200;

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function element(xml, tag) {
  const match = String(xml || '').match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1] : null;
}

function elements(xml, tag) {
  return [...String(xml || '').matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'))]
    .map((match) => match[1]);
}

function textValue(xml, tag) {
  const raw = element(xml, tag);
  return raw == null ? null : decodeXml(raw.replace(/<[^>]+>/g, '')) || null;
}

function wrappedValue(xml, tag) {
  const wrapper = element(xml, tag);
  return wrapper == null ? null : textValue(wrapper, 'value');
}

function numberValue(value) {
  if (value == null || String(value).trim() === '') return null;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function flagValue(value) {
  return /^(1|true|yes)$/i.test(String(value || '').trim());
}

function normalizeCik(value) {
  const digits = String(value || '').replace(/\D/g, '').replace(/^0+/, '');
  return digits || null;
}

function normalizeTicker(value) {
  const ticker = String(value || '').trim().toUpperCase();
  if (!ticker || /^(NONE|N\/A|NA|NOT APPLICABLE)$/i.test(ticker)) return null;
  return ticker;
}

function extractOwnershipXml(submission) {
  return String(submission || '').match(/<ownershipDocument\b[^>]*>[\s\S]*?<\/ownershipDocument>/i)?.[0] || null;
}

function parseFormIndex(indexText) {
  const rows = [];
  for (const line of String(indexText || '').split(/\r?\n/)) {
    const match = line.match(/^(4(?:\/A)?)\s{2,}(.+?)\s{2,}(\d+)\s+(\d{8})\s+(edgar\/data\/\d+\/\S+\.txt)\s*$/);
    if (!match) continue;
    rows.push({
      form: match[1],
      companyName: match[2].trim(),
      cik: normalizeCik(match[3]),
      filedDate: `${match[4].slice(0, 4)}-${match[4].slice(4, 6)}-${match[4].slice(6, 8)}`,
      archivePath: match[5],
      url: `${SEC_BASE}/Archives/${match[5]}`,
    });
  }
  return rows;
}

function parseOwnershipXml(xml) {
  const issuer = element(xml, 'issuer') || '';
  const footnotes = new Map();
  for (const match of String(element(xml, 'footnotes') || '').matchAll(/<footnote\b[^>]*\bid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/footnote>/gi)) {
    footnotes.set(match[1], decodeXml(match[2].replace(/<[^>]+>/g, ' ')));
  }

  const owners = elements(xml, 'reportingOwner').map((ownerXml) => {
    const relationship = element(ownerXml, 'reportingOwnerRelationship') || '';
    return {
      cik: normalizeCik(textValue(ownerXml, 'rptOwnerCik')),
      name: textValue(ownerXml, 'rptOwnerName'),
      director: flagValue(textValue(relationship, 'isDirector')),
      officer: flagValue(textValue(relationship, 'isOfficer')),
      tenPercentOwner: flagValue(textValue(relationship, 'isTenPercentOwner')),
      other: flagValue(textValue(relationship, 'isOther')),
      officerTitle: textValue(relationship, 'officerTitle'),
      otherText: textValue(relationship, 'otherText'),
    };
  });

  const transactions = elements(xml, 'nonDerivativeTransaction').map((transactionXml, index) => {
    const priceXml = element(transactionXml, 'transactionPricePerShare');
    const priceFootnoteIds = priceXml
      ? [...priceXml.matchAll(/<footnoteId\b[^>]*\bid=["']([^"']+)["'][^>]*\/?\s*>/gi)].map((match) => match[1])
      : [];
    const shares = numberValue(wrappedValue(transactionXml, 'transactionShares'));
    const price = numberValue(wrappedValue(transactionXml, 'transactionPricePerShare'));
    return {
      index,
      date: wrappedValue(transactionXml, 'transactionDate'),
      code: textValue(element(transactionXml, 'transactionCoding') || '', 'transactionCode'),
      acquiredDisposed: wrappedValue(transactionXml, 'transactionAcquiredDisposedCode'),
      shares,
      price,
      priceFootnoteIds,
      priceFootnotes: priceFootnoteIds.map((id) => footnotes.get(id)).filter(Boolean),
      notional: shares != null && price != null ? shares * price : null,
    };
  });

  return {
    schemaVersion: textValue(xml, 'schemaVersion'),
    documentType: textValue(xml, 'documentType'),
    periodOfReport: textValue(xml, 'periodOfReport'),
    issuerCik: normalizeCik(textValue(issuer, 'issuerCik')),
    issuerName: textValue(issuer, 'issuerName'),
    issuerTicker: normalizeTicker(textValue(issuer, 'issuerTradingSymbol')),
    owners,
    transactions,
    footnotes,
  };
}

function evenlySpacedSample(rows, limit) {
  if (!Number.isFinite(limit) || limit >= rows.length) return [...rows];
  if (limit <= 0) return [];
  return Array.from({ length: limit }, (_, index) => rows[Math.floor((index + 0.5) * rows.length / limit)]);
}

function percentile(sorted, probability) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const fraction = index - lower;
  return sorted[lower + 1] == null ? sorted[lower] : sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
}

function distribution(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return {
    n: sorted.length,
    min: percentile(sorted, 0),
    p10: percentile(sorted, 0.1),
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
    max: percentile(sorted, 1),
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(response) {
  const value = response.headers.get('retry-after');
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : null;
}

function createSecClient(userAgent) {
  let lastStartedAt = 0;
  let requests = 0;
  return {
    get requestCount() { return requests; },
    async text(url) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const pacingWait = Math.max(0, SEC_MIN_INTERVAL_MS - (Date.now() - lastStartedAt));
        if (pacingWait) await wait(pacingWait);
        lastStartedAt = Date.now();
        requests += 1;
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': userAgent,
              'Accept-Encoding': 'gzip, deflate',
              Accept: 'text/plain, application/xml, text/xml, application/json',
            },
            signal: AbortSignal.timeout(SEC_TIMEOUT_MS),
          });
          if (response.ok) return response.text();
          if (response.status !== 429 && response.status < 500) {
            throw new Error(`SEC vastas ${response.status}: ${url}`);
          }
          const delay = retryAfterMs(response) ?? 1000 * (2 ** attempt);
          if (attempt < 2) await wait(delay);
          else throw new Error(`SEC vastas ${response.status} pärast 3 katset: ${url}`);
        } catch (error) {
          if (attempt >= 2) throw error;
          await wait(1000 * (2 ** attempt));
        }
      }
      throw new Error(`SEC päring ebaõnnestus: ${url}`);
    },
  };
}

function quarterFor(date) {
  const month = Number(date.slice(5, 7));
  return Math.ceil(month / 3);
}

function compactDate(date) {
  return date.replace(/-/g, '');
}

async function latestIndexDates(sec, count) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const quarter = Math.ceil((now.getUTCMonth() + 1) / 3);
  const url = `${SEC_BASE}/Archives/edgar/daily-index/${year}/QTR${quarter}/index.json`;
  const listing = JSON.parse(await sec.text(url));
  const items = listing?.directory?.item || [];
  return items.map((item) => String(item.name || '').match(/^form\.(\d{4})(\d{2})(\d{2})\.idx$/))
    .filter(Boolean)
    .map((match) => `${match[1]}-${match[2]}-${match[3]}`)
    .sort()
    .reverse()
    .slice(0, count);
}

function indexUrl(date) {
  return `${SEC_BASE}/Archives/edgar/daily-index/${date.slice(0, 4)}/QTR${quarterFor(date)}/form.${compactDate(date)}.idx`;
}

async function readCompanyUniverse(databaseUrl) {
  if (!databaseUrl) return { available: false, tickers: new Set(), ciks: new Set(), rows: 0, error: 'DATABASE_URL puudub' };
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query('BEGIN TRANSACTION READ ONLY');
    const result = await client.query('SELECT ticker, sec_cik FROM companies');
    await client.query('COMMIT');
    return {
      available: true,
      tickers: new Set(result.rows.map((row) => normalizeTicker(row.ticker)).filter(Boolean)),
      ciks: new Set(result.rows.map((row) => normalizeCik(row.sec_cik)).filter(Boolean)),
      rows: result.rowCount,
      error: null,
    };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    return { available: false, tickers: new Set(), ciks: new Set(), rows: 0, error: error.message };
  } finally {
    await client.end().catch(() => {});
  }
}

function summarizeDay(date, indexedRows, sampledRows, parsed, failures, companyUniverse) {
  const purchaseFilings = parsed.filter((item) => item.purchases.length > 0);
  const purchaseTransactions = purchaseFilings.flatMap((item) => item.purchases);
  const distinctIssuers = new Map();
  for (const filing of purchaseFilings) {
    const key = filing.parsed.issuerCik || filing.parsed.issuerTicker || filing.indexRow.cik;
    if (!key) continue;
    const current = distinctIssuers.get(key) || {
      cik: filing.parsed.issuerCik || filing.indexRow.cik,
      ticker: filing.parsed.issuerTicker,
      knownNotional: 0,
      fullyComputable: true,
      transactionCount: 0,
      filings: 0,
    };
    current.filings += 1;
    for (const transaction of filing.purchases) {
      current.transactionCount += 1;
      if (transaction.notional == null) current.fullyComputable = false;
      else current.knownNotional += transaction.notional;
    }
    distinctIssuers.set(key, current);
  }
  const issuers = [...distinctIssuers.values()];
  const overlaps = companyUniverse.available
    ? issuers.filter((issuer) => (issuer.ticker && companyUniverse.tickers.has(issuer.ticker))
      || (issuer.cik && companyUniverse.ciks.has(issuer.cik)))
    : [];
  const roleCounts = { director: 0, officer: 0, tenPercentOwner: 0, other: 0, noneDeclared: 0 };
  let ownerRecords = 0;
  for (const filing of purchaseFilings) {
    for (const owner of filing.parsed.owners) {
      ownerRecords += 1;
      let declared = false;
      for (const role of ['director', 'officer', 'tenPercentOwner', 'other']) {
        if (owner[role]) { roleCounts[role] += 1; declared = true; }
      }
      if (!declared) roleCounts.noneDeclared += 1;
    }
  }
  const withPrice = purchaseTransactions.filter((transaction) => transaction.price != null);
  const missingPrice = purchaseTransactions.filter((transaction) => transaction.price == null);
  const footnotedPrice = purchaseTransactions.filter((transaction) => transaction.priceFootnoteIds.length > 0);
  const cleanPrice = purchaseTransactions.filter((transaction) => transaction.price != null && transaction.priceFootnoteIds.length === 0);
  return {
    date,
    indexedFilings: indexedRows.length,
    indexedAmendments: indexedRows.filter((row) => row.form === '4/A').length,
    sampledFilings: sampledRows.length,
    parsedFilings: parsed.length,
    failedFilings: failures.length,
    schemaVersions: [...new Set(parsed.map((item) => item.parsed.schemaVersion).filter(Boolean))].sort(),
    purchaseFilings: purchaseFilings.length,
    purchaseAmendments: purchaseFilings.filter((item) => item.indexRow.form === '4/A').length,
    purchaseTransactions: purchaseTransactions.length,
    distinctPurchaseIssuers: issuers.length,
    issuersWithoutTicker: issuers.filter((issuer) => !issuer.ticker).length,
    usableTickerIssuers: issuers.filter((issuer) => issuer.ticker).length,
    overlapIssuers: overlaps.length,
    newToCompaniesIssuers: companyUniverse.available ? issuers.length - overlaps.length : null,
    potentialNewTickerIssuers: companyUniverse.available
      ? issuers.filter((issuer) => issuer.ticker && !overlaps.includes(issuer)).length
      : null,
    ownerRecords,
    roleCounts,
    price: {
      present: withPrice.length,
      missing: missingPrice.length,
      footnoted: footnotedPrice.length,
      clean: cleanPrice.length,
    },
    transactionNotional: distribution(purchaseTransactions.map((transaction) => transaction.notional)),
    fullyComputableIssuerNotional: distribution(issuers.filter((issuer) => issuer.fullyComputable)
      .map((issuer) => issuer.knownNotional)),
    failures,
  };
}

function parseArgs(argv) {
  const options = { days: DEFAULT_DAYS, dates: null, maxPerDay: DEFAULT_MAX_FILINGS_PER_DAY, report: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === '--days') { options.days = Number(value); index += 1; }
    else if (arg === '--dates') { options.dates = value.split(',').map((item) => item.trim()); index += 1; }
    else if (arg === '--max-filings-per-day') {
      options.maxPerDay = value === 'all' ? Infinity : Number(value);
      index += 1;
    } else if (arg === '--report') { options.report = value; index += 1; }
    else throw new Error(`Tundmatu argument: ${arg}`);
  }
  if (!Number.isInteger(options.days) || options.days < 1 || options.days > 20) throw new Error('--days peab olema 1-20.');
  if (!(options.maxPerDay === Infinity || (Number.isInteger(options.maxPerDay) && options.maxPerDay > 0))) {
    throw new Error('--max-filings-per-day peab olema positiivne täisarv või all.');
  }
  if (options.dates && options.dates.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    throw new Error('--dates kuupäevad peavad olema YYYY-MM-DD.');
  }
  return options;
}

function formatMoney(value) {
  return value == null ? 'n/a' : `$${Math.round(value).toLocaleString('en-US')}`;
}

function formatPercent(numerator, denominator) {
  return denominator ? `${(numerator / denominator * 100).toFixed(1)}%` : 'n/a';
}

function distributionLine(label, stats) {
  return `- ${label}: n=${stats.n}; min ${formatMoney(stats.min)}; p10 ${formatMoney(stats.p10)}; p25 ${formatMoney(stats.p25)}; median ${formatMoney(stats.median)}; p75 ${formatMoney(stats.p75)}; p90 ${formatMoney(stats.p90)}; max ${formatMoney(stats.max)}`;
}

function renderReport(result) {
  const lines = [
    '# SEC Form 4 calibration report', '',
    `Generated: ${result.generatedAt}`, '',
    `Coverage: ${result.days.length} filing days; ${result.sampleMode}; ${result.secRequests} SEC requests.`,
    `Database overlap: ${result.companyUniverse.available ? `${result.companyUniverse.rows} companies read with SELECT-only transaction` : `unavailable (${result.companyUniverse.error})`}.`, '',
    '## Daily results', '',
    '| Date | Indexed 4/4A | 4/A | Parsed | Parse failures | P+A filings | P+A tx | Distinct issuers | Usable tickers | Existing-company overlap |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const day of result.days) {
    lines.push(`| ${day.date} | ${day.indexedFilings} | ${day.indexedAmendments} | ${day.parsedFilings}/${day.sampledFilings} | ${day.failedFilings} | ${day.purchaseFilings} | ${day.purchaseTransactions} | ${day.distinctPurchaseIssuers} | ${day.usableTickerIssuers} | ${result.companyUniverse.available ? `${day.overlapIssuers} (${formatPercent(day.overlapIssuers, day.distinctPurchaseIssuers)})` : 'n/a'} |`);
  }
  lines.push('', 'Counts of purchases and issuers are exact for parsed filings. When the run is sampled rather than full-population, they are sample counts and are not extrapolated.', '');
  for (const day of result.days) {
    lines.push(`## ${day.date}`, '',
      `- Index: ${day.indexedFilings} Form 4/4A filings (${day.indexedAmendments} amendments). Parsed ${day.parsedFilings}/${day.sampledFilings}; failures ${day.failedFilings}.`,
      `- Qualifying rule: non-derivative transaction code P and acquired/disposed A. ${day.purchaseFilings} filings (${formatPercent(day.purchaseFilings, day.parsedFilings)}), ${day.purchaseTransactions} transactions, ${day.distinctPurchaseIssuers} distinct issuers.`,
      `- Qualifying amendments: ${day.purchaseAmendments}. Issuers without a usable ticker: ${day.issuersWithoutTicker}.`,
      `- Price fields: ${day.price.present} present; ${day.price.missing} missing; ${day.price.footnoted} footnoted; ${day.price.clean} present and unfootnoted. Footnoted and missing are independent flags.`,
      `- Reporting-owner records (roles are multi-label): ${day.ownerRecords}; director ${day.roleCounts.director}; officer ${day.roleCounts.officer}; 10% owner ${day.roleCounts.tenPercentOwner}; other ${day.roleCounts.other}; none declared ${day.roleCounts.noneDeclared}.`,
      `- Existing companies overlap: ${result.companyUniverse.available ? `${day.overlapIssuers}/${day.distinctPurchaseIssuers}; ${day.potentialNewTickerIssuers} usable tickers not currently matched by ticker or SEC CIK` : 'not measured'}.`,
      distributionLine('Computable transaction notionals (shares × price)', day.transactionNotional),
      distributionLine('Fully computable issuer-day known-notional sums', day.fullyComputableIssuerNotional),
      `- Observed schema versions: ${day.schemaVersions.join(', ') || 'unknown'}.`, '');
  }
  const total = result.total;
  lines.push('## Combined sample', '',
    `- Parsed ${total.parsedFilings}/${total.sampledFilings} selected filings from ${total.indexedFilings} indexed Form 4/4A filings; ${total.failedFilings} failed.`,
    `- Per-day average: ${total.averageIndexedFilings.toFixed(1)} indexed filings; ${total.averageDistinctIssuers.toFixed(1)} qualifying distinct issuers; ${total.averageUsableTickerIssuers.toFixed(1)} issuers with usable tickers.`,
    `- Qualifying filings: ${total.purchaseFilings} (${formatPercent(total.purchaseFilings, total.parsedFilings)}); qualifying transactions: ${total.purchaseTransactions}.`,
    `- Issuer-day observations: ${total.distinctPurchaseIssuers}; existing-company overlap ${total.overlapIssuers} (${formatPercent(total.overlapIssuers, total.distinctPurchaseIssuers)}); potentially new usable tickers ${total.potentialNewTickerIssuers}.`,
    `- Price present ${total.price.present}; missing ${total.price.missing} (${formatPercent(total.price.missing, total.purchaseTransactions)}); footnoted ${total.price.footnoted} (${formatPercent(total.price.footnoted, total.purchaseTransactions)}); clean ${total.price.clean} (${formatPercent(total.price.clean, total.purchaseTransactions)}).`,
    `- Owner roles, multi-label: director ${total.roleCounts.director}; officer ${total.roleCounts.officer}; 10% owner ${total.roleCounts.tenPercentOwner}; other ${total.roleCounts.other}; none declared ${total.roleCounts.noneDeclared}.`,
    distributionLine('All computable transaction notionals', total.transactionNotional), '',
    '## Method and limitations', '',
    '- Source: SEC EDGAR daily form indexes and complete filing submission text. The parser extracts the embedded `<ownershipDocument>` XML.',
    '- Purchase means only a non-derivative `P` transaction with acquired/disposed value `A`. `P` means open-market or private purchase; the report does not distinguish the two.',
    '- Amendments are reported separately and are not reconciled to originals in this Phase 1 collector.',
    '- Owner-role counts are not mutually exclusive. One reporting owner can be both director and officer.',
    '- A footnoted numeric price remains computable but is counted as footnoted, not clean. Missing and footnoted are independent flags.',
    '- Company overlap is a point-in-time, read-only match by normalized issuer ticker or SEC CIK. It does not mutate or enrich the database.',
    '- No persistence, discovery selection, score, ranking, candidate, or UI logic is executed.', '');
  return `${lines.join('\n')}\n`;
}

function combineDays(days) {
  const transactions = days.flatMap((day) => day._transactionNotionals || []);
  const count = days.length || 1;
  return {
    indexedFilings: days.reduce((sum, day) => sum + day.indexedFilings, 0),
    sampledFilings: days.reduce((sum, day) => sum + day.sampledFilings, 0),
    parsedFilings: days.reduce((sum, day) => sum + day.parsedFilings, 0),
    failedFilings: days.reduce((sum, day) => sum + day.failedFilings, 0),
    purchaseFilings: days.reduce((sum, day) => sum + day.purchaseFilings, 0),
    purchaseTransactions: days.reduce((sum, day) => sum + day.purchaseTransactions, 0),
    distinctPurchaseIssuers: days.reduce((sum, day) => sum + day.distinctPurchaseIssuers, 0),
    usableTickerIssuers: days.reduce((sum, day) => sum + day.usableTickerIssuers, 0),
    overlapIssuers: days.reduce((sum, day) => sum + day.overlapIssuers, 0),
    potentialNewTickerIssuers: days.reduce((sum, day) => sum + (day.potentialNewTickerIssuers || 0), 0),
    averageIndexedFilings: days.reduce((sum, day) => sum + day.indexedFilings, 0) / count,
    averageDistinctIssuers: days.reduce((sum, day) => sum + day.distinctPurchaseIssuers, 0) / count,
    averageUsableTickerIssuers: days.reduce((sum, day) => sum + day.usableTickerIssuers, 0) / count,
    price: Object.fromEntries(['present', 'missing', 'footnoted', 'clean'].map((key) => [key, days.reduce((sum, day) => sum + day.price[key], 0)])),
    roleCounts: Object.fromEntries(['director', 'officer', 'tenPercentOwner', 'other', 'noneDeclared'].map((key) => [key, days.reduce((sum, day) => sum + day.roleCounts[key], 0)])),
    transactionNotional: distribution(transactions),
  };
}

async function main(argv = process.argv.slice(2)) {
  const root = repoRoot();
  registerRepoModules(root);
  loadEnv(root);
  if (!process.env.SEC_USER_AGENT) throw new Error('SEC_USER_AGENT puudub.');
  const options = parseArgs(argv);
  const sec = createSecClient(process.env.SEC_USER_AGENT);
  const dates = options.dates || await latestIndexDates(sec, options.days);
  const companyUniversePromise = readCompanyUniverse(process.env.DATABASE_URL);
  const dayInputs = [];

  console.log('=== SEC Form 4 calibration (read-only) ===');
  console.log(`Dates: ${dates.join(', ')}`);
  console.log(`Per-day filing coverage: ${options.maxPerDay === Infinity ? 'ALL' : options.maxPerDay}`);
  console.log('SEC pacing: sequential, >=200 ms between request starts (<=5 req/s), 10 s timeout');
  console.log('Database: SELECT companies only; no INSERT/UPDATE/DELETE/DDL');

  for (const date of dates) {
    const indexedRows = parseFormIndex(await sec.text(indexUrl(date)));
    const sampledRows = evenlySpacedSample(indexedRows, options.maxPerDay);
    const parsed = [];
    const failures = [];
    console.log(`\n${date}: indexed ${indexedRows.length}; selected ${sampledRows.length}`);
    for (const [index, indexRow] of sampledRows.entries()) {
      try {
        const submission = await sec.text(indexRow.url);
        const xml = extractOwnershipXml(submission);
        if (!xml) throw new Error('ownershipDocument XML puudub');
        const ownership = parseOwnershipXml(xml);
        const purchases = ownership.transactions.filter((transaction) => transaction.code === 'P' && transaction.acquiredDisposed === 'A');
        parsed.push({ indexRow, parsed: ownership, purchases });
      } catch (error) {
        failures.push({ url: indexRow.url, error: error.message });
      }
      if ((index + 1) % 50 === 0 || index + 1 === sampledRows.length) {
        console.log(`  ${index + 1}/${sampledRows.length} fetched; parsed ${parsed.length}; failures ${failures.length}`);
      }
    }
    dayInputs.push({ date, indexedRows, sampledRows, parsed, failures });
  }

  const companyUniverse = await companyUniversePromise;
  const days = dayInputs.map((input) => {
    const summary = summarizeDay(input.date, input.indexedRows, input.sampledRows, input.parsed, input.failures, companyUniverse);
    summary._transactionNotionals = input.parsed.flatMap((item) => item.purchases.map((transaction) => transaction.notional));
    return summary;
  });
  const result = {
    generatedAt: new Date().toISOString(),
    sampleMode: options.maxPerDay === Infinity ? 'full population requested for each day' : `deterministic evenly spaced sample, max ${options.maxPerDay} filings/day`,
    secRequests: sec.requestCount,
    companyUniverse,
    days,
    total: combineDays(days),
  };
  const report = renderReport(result);
  console.log(`\n${report}`);
  if (options.report) {
    const reportPath = path.resolve(root, options.report);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, report, 'utf8');
    console.log(`Report written: ${reportPath}`);
  }
  return result;
}

module.exports = {
  combineDays,
  distribution,
  evenlySpacedSample,
  extractOwnershipXml,
  parseArgs,
  parseFormIndex,
  parseOwnershipXml,
  renderReport,
  summarizeDay,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`FORM 4 CALIBRATION FAILED: ${error.message}`);
    process.exitCode = 1;
  });
}
