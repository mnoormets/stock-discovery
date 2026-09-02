// Pure Nasdaq Trader symbol-directory parsing and classification primitives.
// This module has no database dependency and performs no writes.

const { createHash } = require('node:crypto');

const NASDAQ_LISTED_URL = 'https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt';
const NASDAQ_ADDS_DELETES_URL = 'https://www.nasdaqtrader.com/dynamic/SymDir/TradingSystemAddsDeletes.txt';
const NASDAQ_LISTING_POLICY_VERSION = 'nasdaq-new-listing-observation-v1';
const NASDAQ_LISTED_HEADER = 'Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares';
const ADDS_DELETES_HEADER = 'Symbol|Company Name|NASDAQ Action|BX Action|PSX Action|Effective Date|Primary Listing Market';
const NASDAQ_PRIMARY_MARKETS = new Set(['Q', 'G', 'S']);

function normalizeLines(text) {
  return String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim() !== '');
}

function parseFileCreationTime(line) {
  const match = String(line || '').match(/^File Creation Time:\s*(\d{2})(\d{2})(\d{4})(\d{2}):(\d{2})\|*$/);
  if (!match) throw new Error('Nasdaq faili creation timestamp puudub või on tundmatus formaadis.');
  const [, month, day, year, hour, minute] = match;
  const date = `${year}-${month}-${day}`;
  const parsed = new Date(`${date}T${hour}:${minute}:00Z`);
  if (!Number.isFinite(parsed.getTime())
      || parsed.getUTCFullYear() !== Number(year)
      || parsed.getUTCMonth() + 1 !== Number(month)
      || parsed.getUTCDate() !== Number(day)
      || Number(hour) > 23
      || Number(minute) > 59) {
    throw new Error(`Nasdaq faili creation timestamp ei ole kehtiv: ${match[0]}`);
  }
  return { raw: `${month}${day}${year}${hour}:${minute}`, date, time: `${hour}:${minute}`, timeZone: null };
}

function assertHeader(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} päis muutus: ${actual || '(puudub)'}`);
}

function yn(value, field, symbol) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized !== 'Y' && normalized !== 'N') throw new Error(`${symbol}: ${field} peab olema Y või N.`);
  return normalized;
}

function parseNasdaqListed(text) {
  const contentSha256 = createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
  const lines = normalizeLines(text);
  assertHeader(lines[0], NASDAQ_LISTED_HEADER, 'nasdaqlisted.txt');
  const fileCreation = parseFileCreationTime(lines.at(-1));
  const rows = [];
  const symbols = new Set();
  for (const [index, line] of lines.slice(1, -1).entries()) {
    const fields = line.split('|');
    if (fields.length !== 8) throw new Error(`nasdaqlisted.txt rida ${index + 2} sisaldab ${fields.length} välja, oodati 8.`);
    const symbol = fields[0].trim().toUpperCase();
    if (!symbol) throw new Error(`nasdaqlisted.txt rida ${index + 2}: ticker puudub.`);
    if (symbols.has(symbol)) throw new Error(`nasdaqlisted.txt sisaldab duplikaattickerit ${symbol}.`);
    symbols.add(symbol);
    const marketCategory = fields[2].trim().toUpperCase();
    if (!NASDAQ_PRIMARY_MARKETS.has(marketCategory)) throw new Error(`${symbol}: tundmatu Nasdaq market category ${marketCategory || '(puudub)'}.`);
    const roundLotSize = Number(fields[5]);
    if (!Number.isInteger(roundLotSize) || roundLotSize < 0) throw new Error(`${symbol}: vigane round lot size.`);
    rows.push({
      symbol,
      securityName: fields[1].trim(),
      marketCategory,
      testIssue: yn(fields[3], 'Test Issue', symbol),
      financialStatus: fields[4].trim().toUpperCase(),
      roundLotSize,
      etf: yn(fields[6], 'ETF', symbol),
      nextShares: yn(fields[7], 'NextShares', symbol),
    });
  }
  return { contentSha256, fileCreation, rows };
}

function normalizeUsDate(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match;
  const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const parsed = new Date(`${normalized}T00:00:00Z`);
  return Number.isFinite(parsed.getTime())
    && parsed.getUTCFullYear() === Number(year)
    && parsed.getUTCMonth() + 1 === Number(month)
    && parsed.getUTCDate() === Number(day)
    ? normalized : null;
}

function parseAddsDeletes(text) {
  const contentSha256 = createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
  const lines = normalizeLines(text);
  assertHeader(lines[0], ADDS_DELETES_HEADER, 'TradingSystemAddsDeletes.txt');
  const fileCreation = parseFileCreationTime(lines.at(-1));
  const rows = lines.slice(1, -1).map((line, index) => {
    const fields = line.split('|');
    if (fields.length !== 7) throw new Error(`TradingSystemAddsDeletes.txt rida ${index + 2} sisaldab ${fields.length} välja, oodati 7.`);
    const symbol = fields[0].trim().toUpperCase();
    const nasdaqAction = fields[2].trim();
    const effectiveDate = normalizeUsDate(fields[5]);
    if (!symbol) throw new Error(`TradingSystemAddsDeletes.txt rida ${index + 2}: ticker puudub.`);
    if (!['Add', 'Delete', ''].includes(nasdaqAction)) throw new Error(`${symbol}: tundmatu NASDAQ action ${nasdaqAction}.`);
    if (!effectiveDate) throw new Error(`${symbol}: vigane effective date ${fields[5]}.`);
    return {
      symbol,
      companyName: fields[1].trim(),
      nasdaqAction,
      bxAction: fields[3].trim(),
      psxAction: fields[4].trim(),
      effectiveDate,
      primaryListingMarket: fields[6].trim().toUpperCase(),
    };
  });
  return { contentSha256, fileCreation, rows };
}

function instrumentKind(securityName) {
  const name = String(securityName || '');
  if (/\bWarrants?\b/i.test(name)) return 'warrant';
  if (/\bUnits?\b/i.test(name)) return 'unit';
  if (/\bRights?\b/i.test(name)) return 'right';
  if (/\bPreferred\b/i.test(name)) return 'preferred';
  if (/\bETF\b|\bETN\b|\bETP\b|\bFund\b/i.test(name)) return 'fund';
  if (/\bSenior Notes?\b|\bDebentures?\b|\bBonds?\b/i.test(name)) return 'debt';
  if (/\bAcquisition\b|\bBlank Check\b/i.test(name)) return 'spac';
  if (/American Depositary|\bADS\b/i.test(name)) return 'ads';
  return 'equity_or_unknown';
}

function classifyDirectorySecurity(row) {
  const reasons = [];
  if (row.testIssue !== 'N') reasons.push('test_issue');
  if (row.etf !== 'N') reasons.push('etf');
  if (row.nextShares !== 'N') reasons.push('nextshares');
  if (row.financialStatus !== 'N') reasons.push(`financial_status_${row.financialStatus || 'unknown'}`);
  const kind = instrumentKind(row.securityName);
  if (['warrant', 'unit', 'right', 'preferred', 'debt', 'fund'].includes(kind)) reasons.push(`instrument_${kind}`);
  if (reasons.length) return { instrumentKind: kind, eligibility: 'excluded', reasons };
  if (kind === 'spac') return { instrumentKind: kind, eligibility: 'radar_only', reasons: ['spac_or_blank_check'] };
  return { instrumentKind: kind, eligibility: 'lookup_ready', reasons: [] };
}

function classifyTradingEvent(event, directoryBySymbol) {
  if (event.nasdaqAction !== 'Add') {
    return { status: 'not_add', instrumentKind: null, directoryConfirmed: false, reasons: ['nasdaq_action_not_add'] };
  }
  if (!NASDAQ_PRIMARY_MARKETS.has(event.primaryListingMarket)) {
    return { status: 'excluded', instrumentKind: null, directoryConfirmed: false, reasons: ['not_nasdaq_primary_listing'] };
  }
  const directoryRow = directoryBySymbol.get(event.symbol);
  if (!directoryRow) {
    return { status: 'pending_directory_confirmation', instrumentKind: null, directoryConfirmed: false, reasons: ['directory_confirmation_missing'] };
  }
  const classification = classifyDirectorySecurity(directoryRow);
  if (directoryRow.marketCategory !== event.primaryListingMarket) {
    return {
      status: 'excluded',
      instrumentKind: classification.instrumentKind,
      directoryConfirmed: true,
      reasons: ['primary_market_mismatch', ...classification.reasons],
    };
  }
  return {
    status: classification.eligibility,
    instrumentKind: classification.instrumentKind,
    directoryConfirmed: true,
    reasons: classification.reasons,
  };
}

function comparableRow(row) {
  return JSON.stringify([
    row.securityName, row.marketCategory, row.testIssue, row.financialStatus,
    row.roundLotSize, row.etf, row.nextShares,
  ]);
}

function diffDirectories(previousRows, currentRows) {
  if (!previousRows) return { baselineExisting: currentRows.length, added: [], removed: [], changed: [] };
  const previous = new Map(previousRows.map((row) => [row.symbol, row]));
  const current = new Map(currentRows.map((row) => [row.symbol, row]));
  const added = currentRows.filter((row) => !previous.has(row.symbol));
  const removed = previousRows.filter((row) => !current.has(row.symbol));
  const changed = currentRows.filter((row) => previous.has(row.symbol)
    && comparableRow(previous.get(row.symbol)) !== comparableRow(row));
  return { baselineExisting: 0, added, removed, changed };
}

async function fetchNasdaqText(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const attempts = options.attempts ?? 3;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'text/plain', 'User-Agent': 'stock-discovery-nasdaq-calibration/1.0' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return response.text();
      if (response.status < 500 && response.status !== 429) throw new Error(`Nasdaq vastas ${response.status}: ${url}`);
      if (attempt + 1 === attempts) throw new Error(`Nasdaq vastas ${response.status} pärast ${attempts} katset: ${url}`);
    } catch (error) {
      if (attempt + 1 === attempts) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
  }
  throw new Error(`Nasdaq päring ebaõnnestus: ${url}`);
}

module.exports = {
  ADDS_DELETES_HEADER,
  NASDAQ_ADDS_DELETES_URL,
  NASDAQ_LISTED_HEADER,
  NASDAQ_LISTED_URL,
  NASDAQ_LISTING_POLICY_VERSION,
  classifyDirectorySecurity,
  classifyTradingEvent,
  diffDirectories,
  fetchNasdaqText,
  instrumentKind,
  parseAddsDeletes,
  parseFileCreationTime,
  parseNasdaqListed,
};
