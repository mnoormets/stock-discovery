// Shared SEC Form 4 index, request and Ownership XML parsing primitives.
// This module has no database writes and is used by both calibration and ingestion CLIs.

const { createHash } = require('node:crypto');

const SEC_BASE = 'https://www.sec.gov';
const SEC_TIMEOUT_MS = 10_000;
const SEC_MIN_INTERVAL_MS = 200;
const FORM4_PARSER_VERSION = 'form4-ownership-v1';

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

function nullableFlagValue(value) {
  if (value == null || String(value).trim() === '') return null;
  if (/^(1|true|yes)$/i.test(String(value).trim())) return true;
  if (/^(0|false|no)$/i.test(String(value).trim())) return false;
  return null;
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

function normalizeDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function extractOwnershipXml(submission) {
  return String(submission || '').match(/<ownershipDocument\b[^>]*>[\s\S]*?<\/ownershipDocument>/i)?.[0] || null;
}

function accessionFromArchivePath(archivePath) {
  const match = String(archivePath || '').match(/\/([0-9]{10}-[0-9]{2}-[0-9]{6})\.txt$/);
  return match?.[1] || null;
}

function parseFormIndex(indexText) {
  const rows = [];
  for (const line of String(indexText || '').split(/\r?\n/)) {
    const match = line.match(/^(4(?:\/A)?)\s{2,}(.+?)\s{2,}(\d+)\s+(\d{8})\s+(edgar\/data\/\d+\/\S+\.txt)\s*$/);
    if (!match) continue;
    const archivePath = match[5];
    rows.push({
      form: match[1],
      companyName: match[2].trim(),
      cik: normalizeCik(match[3]),
      filedDate: normalizeDate(match[4]),
      accessionNumber: accessionFromArchivePath(archivePath),
      archivePath,
      url: `${SEC_BASE}/Archives/${archivePath}`,
    });
  }
  return rows;
}

function footnoteIds(xml) {
  return [...String(xml || '').matchAll(/<footnoteId\b[^>]*\bid=["']([^"']+)["'][^>]*\/?\s*>/gi)]
    .map((match) => match[1]);
}

function parseFootnoteMap(xml) {
  const footnotes = new Map();
  for (const match of String(element(xml, 'footnotes') || '').matchAll(/<footnote\b[^>]*\bid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/footnote>/gi)) {
    footnotes.set(match[1], decodeXml(match[2].replace(/<[^>]+>/g, ' ')));
  }
  return footnotes;
}

const TRANSACTION_FOOTNOTE_FIELDS = [
  ['transaction_date', 'transactionDate'],
  ['deemed_execution_date', 'deemedExecutionDate'],
  ['security_title', 'securityTitle'],
  ['transaction_shares', 'transactionShares'],
  ['transaction_price_per_share', 'transactionPricePerShare'],
  ['acquired_disposed_code', 'transactionAcquiredDisposedCode'],
  ['post_transaction_shares', 'sharesOwnedFollowingTransaction'],
  ['direct_or_indirect_ownership', 'directOrIndirectOwnership'],
  ['nature_of_ownership', 'natureOfOwnership'],
  ['conversion_or_exercise_price', 'conversionOrExercisePrice'],
  ['exercise_date', 'exerciseDate'],
  ['expiration_date', 'expirationDate'],
  ['underlying_security_title', 'underlyingSecurityTitle'],
  ['underlying_security_shares', 'underlyingSecurityShares'],
];

function scopedTransactionFootnotes(transactionXml, footnoteMap) {
  const result = [];
  const seen = new Set();
  for (const [fieldName, tag] of TRANSACTION_FOOTNOTE_FIELDS) {
    const fieldXml = element(transactionXml, tag);
    for (const id of footnoteIds(fieldXml)) {
      const key = `${fieldName}\u0000${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ fieldName, id, text: footnoteMap.get(id) || null });
    }
  }
  return result;
}

function parseTransaction(transactionXml, index, securityKind, footnoteMap) {
  const coding = element(transactionXml, 'transactionCoding') || '';
  const amounts = element(transactionXml, 'transactionAmounts') || '';
  const postAmounts = element(transactionXml, 'postTransactionAmounts') || '';
  const ownership = element(transactionXml, 'ownershipNature') || '';
  const underlying = element(transactionXml, 'underlyingSecurity') || '';
  const shares = numberValue(wrappedValue(amounts, 'transactionShares'));
  const price = numberValue(wrappedValue(amounts, 'transactionPricePerShare'));
  const priceXml = element(amounts, 'transactionPricePerShare');
  const priceFootnoteIds = footnoteIds(priceXml);
  const footnotes = scopedTransactionFootnotes(transactionXml, footnoteMap);
  return {
    index,
    rowKey: `${securityKind}:${String(index).padStart(4, '0')}`,
    securityKind,
    date: normalizeDate(wrappedValue(transactionXml, 'transactionDate')),
    deemedExecutionDate: normalizeDate(wrappedValue(transactionXml, 'deemedExecutionDate')),
    securityTitle: wrappedValue(transactionXml, 'securityTitle'),
    transactionFormType: textValue(coding, 'transactionFormType'),
    code: textValue(coding, 'transactionCode'),
    acquiredDisposed: wrappedValue(amounts, 'transactionAcquiredDisposedCode'),
    transactionTimeliness: textValue(coding, 'transactionTimeliness'),
    equitySwapInvolved: nullableFlagValue(textValue(coding, 'equitySwapInvolved')),
    rule10b5One: nullableFlagValue(textValue(coding, 'aff10b5One')),
    shares,
    price,
    postTransactionShares: numberValue(wrappedValue(postAmounts, 'sharesOwnedFollowingTransaction')),
    directOrIndirectOwnership: wrappedValue(ownership, 'directOrIndirectOwnership'),
    natureOfOwnership: wrappedValue(ownership, 'natureOfOwnership'),
    conversionOrExercisePrice: numberValue(wrappedValue(transactionXml, 'conversionOrExercisePrice')),
    exerciseDate: normalizeDate(wrappedValue(transactionXml, 'exerciseDate')),
    expirationDate: normalizeDate(wrappedValue(transactionXml, 'expirationDate')),
    underlyingSecurityTitle: wrappedValue(underlying, 'underlyingSecurityTitle'),
    underlyingSecurityShares: numberValue(wrappedValue(underlying, 'underlyingSecurityShares')),
    priceFootnoteIds,
    priceFootnotes: priceFootnoteIds.map((id) => footnoteMap.get(id)).filter(Boolean),
    footnotes,
    notional: securityKind === 'non_derivative' && shares != null && price != null ? shares * price : null,
  };
}

function parseOwnershipXml(xml) {
  const issuer = element(xml, 'issuer') || '';
  const footnotes = parseFootnoteMap(xml);
  const owners = elements(xml, 'reportingOwner').map((ownerXml, index) => {
    const relationship = element(ownerXml, 'reportingOwnerRelationship') || '';
    return {
      rowKey: `reporting_owner:${String(index).padStart(4, '0')}`,
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
  const transactions = [
    ...elements(xml, 'nonDerivativeTransaction').map((item, index) => parseTransaction(item, index, 'non_derivative', footnotes)),
    ...elements(xml, 'derivativeTransaction').map((item, index) => parseTransaction(item, index, 'derivative', footnotes)),
  ];
  return {
    schemaVersion: textValue(xml, 'schemaVersion'),
    documentType: textValue(xml, 'documentType'),
    periodOfReport: normalizeDate(textValue(xml, 'periodOfReport')),
    dateOfOriginalSubmission: normalizeDate(textValue(xml, 'dateOfOriginalSubmission')),
    issuerCik: normalizeCik(textValue(issuer, 'issuerCik')),
    issuerName: textValue(issuer, 'issuerName'),
    issuerTicker: normalizeTicker(textValue(issuer, 'issuerTradingSymbol')),
    owners,
    transactions,
    footnotes,
  };
}

function extractPrimaryDocumentFilename(submission) {
  for (const document of String(submission || '').match(/<DOCUMENT>[\s\S]*?<\/DOCUMENT>/gi) || []) {
    if (!/<ownershipDocument\b/i.test(document)) continue;
    const filename = document.match(/<FILENAME>\s*([^\r\n<]+)/i)?.[1]?.trim();
    if (filename) return filename;
  }
  return null;
}

function acceptedAtFromSubmission(submission) {
  const value = String(submission || '').match(/<ACCEPTANCE-DATETIME>\s*(\d{14})/i)?.[1];
  if (!value) return null;
  // EDGAR reports this header in US Eastern local time. PostgreSQL applies the
  // historical America/New_York offset when persistence converts it to timestamptz.
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}`;
}

function primaryDocumentUrl(indexRow, filename) {
  if (!filename || !indexRow.accessionNumber || !indexRow.cik) return null;
  const directory = indexRow.accessionNumber.replace(/-/g, '');
  return `${SEC_BASE}/Archives/edgar/data/${indexRow.cik}/${directory}/${filename}`;
}

function parseOwnershipSubmission(submission, indexRow) {
  const xml = extractOwnershipXml(submission);
  if (!xml) throw new Error('ownershipDocument XML puudub');
  const parsed = parseOwnershipXml(xml);
  const filename = extractPrimaryDocumentFilename(submission);
  return {
    ...parsed,
    accessionNumber: indexRow.accessionNumber || accessionFromArchivePath(indexRow.archivePath),
    formType: indexRow.form || parsed.documentType,
    filedDate: indexRow.filedDate,
    acceptedAt: acceptedAtFromSubmission(submission),
    primaryDocumentFilename: filename,
    primaryDocumentUrl: primaryDocumentUrl(indexRow, filename),
    submissionUrl: indexRow.url,
    ownershipXmlSha256: createHash('sha256').update(xml, 'utf8').digest('hex'),
    parserVersion: FORM4_PARSER_VERSION,
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
  return Math.ceil(Number(date.slice(5, 7)) / 3);
}

function compactDate(date) {
  return date.replace(/-/g, '');
}

function indexUrl(date) {
  return `${SEC_BASE}/Archives/edgar/daily-index/${date.slice(0, 4)}/QTR${quarterFor(date)}/form.${compactDate(date)}.idx`;
}

function quarterDirectoryUrl(year, quarter) {
  return `${SEC_BASE}/Archives/edgar/daily-index/${year}/QTR${quarter}/index.json`;
}

function datesFromQuarterListing(listing) {
  return (listing?.directory?.item || [])
    .map((item) => String(item.name || '').match(/^form\.(\d{4})(\d{2})(\d{2})\.idx$/))
    .filter(Boolean)
    .map((match) => `${match[1]}-${match[2]}-${match[3]}`)
    .sort();
}

async function latestIndexDates(sec, count, now = new Date()) {
  const year = now.getUTCFullYear();
  const quarter = Math.ceil((now.getUTCMonth() + 1) / 3);
  const listing = JSON.parse(await sec.text(quarterDirectoryUrl(year, quarter)));
  return datesFromQuarterListing(listing).reverse().slice(0, count);
}

function quartersInRange(from, to) {
  const result = [];
  let year = Number(from.slice(0, 4));
  let quarter = quarterFor(from);
  const endYear = Number(to.slice(0, 4));
  const endQuarter = quarterFor(to);
  while (year < endYear || (year === endYear && quarter <= endQuarter)) {
    result.push({ year, quarter });
    quarter += 1;
    if (quarter === 5) { quarter = 1; year += 1; }
  }
  return result;
}

async function indexDatesInRange(sec, from, to) {
  const dates = [];
  for (const { year, quarter } of quartersInRange(from, to)) {
    const listing = JSON.parse(await sec.text(quarterDirectoryUrl(year, quarter)));
    dates.push(...datesFromQuarterListing(listing).filter((date) => date >= from && date <= to));
  }
  return [...new Set(dates)].sort();
}

module.exports = {
  FORM4_PARSER_VERSION,
  SEC_BASE,
  accessionFromArchivePath,
  createSecClient,
  datesFromQuarterListing,
  extractOwnershipXml,
  extractPrimaryDocumentFilename,
  indexDatesInRange,
  indexUrl,
  latestIndexDates,
  normalizeCik,
  normalizeTicker,
  parseFormIndex,
  parseOwnershipSubmission,
  parseOwnershipXml,
  quarterFor,
};
