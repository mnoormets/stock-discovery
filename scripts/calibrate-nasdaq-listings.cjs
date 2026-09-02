// Read-only Nasdaq Trader new-listing calibration. Fetches two public text
// files and optionally compares the current directory with a local prior file.
// It never connects to or writes a database.
//
// Usage:
//   npm run calibrate:nasdaq-listings
//   npm run calibrate:nasdaq-listings -- --json
//   npm run calibrate:nasdaq-listings -- --previous path/to/nasdaqlisted.txt
//   npm run calibrate:nasdaq-listings -- --artifact-dir path/to/output

const fs = require('node:fs');
const path = require('node:path');
const {
  NASDAQ_ADDS_DELETES_URL,
  NASDAQ_LISTED_URL,
  NASDAQ_LISTING_POLICY_VERSION,
  classifyDirectorySecurity,
  classifyTradingEvent,
  diffDirectories,
  fetchNasdaqText,
  parseAddsDeletes,
  parseNasdaqListed,
} = require('./_nasdaq-listings.cjs');

function parseArgs(argv) {
  const options = { artifactDir: null, json: false, previous: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--artifact-dir') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--artifact-dir vajab väljundkausta teed.');
      options.artifactDir = value;
      index += 1;
    }
    else if (arg === '--previous') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--previous vajab nasdaqlisted.txt faili teed.');
      options.previous = value;
      index += 1;
    } else throw new Error(`Tundmatu argument: ${arg}`);
  }
  return options;
}

function writeArtifacts(artifactDir, directoryText, actionsText, report) {
  const resolved = path.resolve(artifactDir);
  fs.mkdirSync(resolved, { recursive: true });
  const files = {
    nasdaqListed: path.join(resolved, 'nasdaqlisted.txt'),
    addsDeletes: path.join(resolved, 'TradingSystemAddsDeletes.txt'),
    report: path.join(resolved, 'observation.json'),
  };
  fs.writeFileSync(files.nasdaqListed, directoryText, 'utf8');
  fs.writeFileSync(files.addsDeletes, actionsText, 'utf8');
  fs.writeFileSync(files.report, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return files;
}

function increment(target, key) {
  target[key] = (target[key] || 0) + 1;
}

function buildReport(directory, actions, previousDirectory = null, generatedAt = new Date()) {
  const directoryBySymbol = new Map(directory.rows.map((row) => [row.symbol, row]));
  const directoryCounts = {
    total: directory.rows.length,
    marketCategory: {},
    financialStatus: {},
    testIssues: 0,
    etfs: 0,
    nextShares: 0,
    basicEligible: 0,
    lookupReady: 0,
    radarOnly: 0,
    excluded: 0,
    instrumentKind: {},
  };
  for (const row of directory.rows) {
    increment(directoryCounts.marketCategory, row.marketCategory);
    increment(directoryCounts.financialStatus, row.financialStatus || 'unknown');
    if (row.testIssue === 'Y') directoryCounts.testIssues += 1;
    if (row.etf === 'Y') directoryCounts.etfs += 1;
    if (row.nextShares === 'Y') directoryCounts.nextShares += 1;
    if (row.testIssue === 'N' && row.etf === 'N' && row.nextShares === 'N' && row.financialStatus === 'N') {
      directoryCounts.basicEligible += 1;
    }
    const classification = classifyDirectorySecurity(row);
    increment(directoryCounts, classification.eligibility === 'lookup_ready' ? 'lookupReady' : classification.eligibility === 'radar_only' ? 'radarOnly' : 'excluded');
    increment(directoryCounts.instrumentKind, classification.instrumentKind);
  }

  const eventCounts = { total: actions.rows.length, add: 0, delete: 0, lookupReady: 0, radarOnly: 0, excluded: 0, pendingDirectoryConfirmation: 0, notAdd: 0 };
  const events = actions.rows.map((event) => {
    if (event.nasdaqAction === 'Add') eventCounts.add += 1;
    if (event.nasdaqAction === 'Delete') eventCounts.delete += 1;
    const classification = classifyTradingEvent(event, directoryBySymbol);
    const key = classification.status === 'lookup_ready' ? 'lookupReady'
      : classification.status === 'radar_only' ? 'radarOnly'
        : classification.status === 'pending_directory_confirmation' ? 'pendingDirectoryConfirmation'
          : classification.status === 'not_add' ? 'notAdd' : 'excluded';
    eventCounts[key] += 1;
    return { ...event, ...classification };
  });

  const directoryDiff = diffDirectories(previousDirectory?.rows || null, directory.rows);
  return {
    schemaVersion: 'nasdaq-listing-calibration-v1',
    policyVersion: NASDAQ_LISTING_POLICY_VERSION,
    generatedAt: generatedAt.toISOString(),
    source: {
      nasdaqListed: { url: NASDAQ_LISTED_URL, fileCreation: directory.fileCreation, contentSha256: directory.contentSha256 },
      addsDeletes: { url: NASDAQ_ADDS_DELETES_URL, fileCreation: actions.fileCreation, contentSha256: actions.contentSha256 },
      timestampTimeZoneKnown: false,
    },
    directory: directoryCounts,
    events: { counts: eventCounts, rows: events },
    diff: {
      previousProvided: Boolean(previousDirectory),
      baselineExisting: directoryDiff.baselineExisting,
      added: directoryDiff.added.map((row) => row.symbol),
      removed: directoryDiff.removed.map((row) => row.symbol),
      changed: directoryDiff.changed.map((row) => row.symbol),
    },
    limitations: [
      'Add means a trading-system event, not proof of an IPO.',
      'A new Nasdaq-primary issue is lookup-ready only after directory confirmation.',
      'The free current files do not provide historical backfill.',
      'Nasdaq does not declare the file-creation timestamp time zone on the field-definition page.',
      'SPAC or blank-check common shares remain radar-only in policy v1.',
    ],
  };
}

function renderReport(report) {
  const d = report.directory;
  const e = report.events.counts;
  const lines = [
    '=== Nasdaq new-listing calibration (read-only) ===',
    `Policy: ${report.policyVersion}`,
    `Generated: ${report.generatedAt}`,
    'Database: not connected; no writes',
    '',
    `nasdaqlisted.txt creation: ${report.source.nasdaqListed.fileCreation.date} ${report.source.nasdaqListed.fileCreation.time} (source time zone not declared)`,
    `TradingSystemAddsDeletes.txt creation: ${report.source.addsDeletes.fileCreation.date} ${report.source.addsDeletes.fileCreation.time} (source time zone not declared)`,
    '',
    `Directory: ${d.total} rows; markets Q=${d.marketCategory.Q || 0}, G=${d.marketCategory.G || 0}, S=${d.marketCategory.S || 0}`,
    `Directory flags: test=${d.testIssues}, ETF=${d.etfs}, NextShares=${d.nextShares}, non-normal financial status=${d.total - (d.financialStatus.N || 0)}`,
    `Directory funnel: basic eligible=${d.basicEligible}, lookup-ready=${d.lookupReady}, radar-only=${d.radarOnly}, excluded=${d.excluded}`,
    `Instrument labels: ${Object.entries(d.instrumentKind).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join(', ')}`,
    '',
    `Current events: ${e.total}; Add=${e.add}, Delete=${e.delete}`,
    `Event funnel: lookup-ready=${e.lookupReady}, radar-only=${e.radarOnly}, pending directory confirmation=${e.pendingDirectoryConfirmation}, excluded=${e.excluded}, not-add=${e.notAdd}`,
  ];
  for (const event of report.events.rows) {
    lines.push(`- ${event.symbol} ${event.nasdaqAction || 'no-action'} ${event.primaryListingMarket || 'unknown-market'}: ${event.status}; ${event.instrumentKind || 'instrument unknown'}; ${event.reasons.join(', ') || 'no rejection reasons'}`);
  }
  lines.push('', report.diff.previousProvided
    ? `Directory diff: added=${report.diff.added.length}, removed=${report.diff.removed.length}, changed=${report.diff.changed.length}`
    : `Directory diff: baseline only (${report.diff.baselineExisting} existing rows); no symbol is called new without a previous complete snapshot.`);
  return `${lines.join('\n')}\n`;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const [directoryText, actionsText] = await Promise.all([
    fetchNasdaqText(NASDAQ_LISTED_URL),
    fetchNasdaqText(NASDAQ_ADDS_DELETES_URL),
  ]);
  const directory = parseNasdaqListed(directoryText);
  const actions = parseAddsDeletes(actionsText);
  const previousDirectory = options.previous
    ? parseNasdaqListed(fs.readFileSync(path.resolve(options.previous), 'utf8'))
    : null;
  const report = buildReport(directory, actions, previousDirectory);
  if (options.artifactDir) writeArtifacts(options.artifactDir, directoryText, actionsText, report);
  console.log(options.json ? JSON.stringify(report, null, 2) : renderReport(report));
  return report;
}

module.exports = { buildReport, main, parseArgs, renderReport, writeArtifacts };

if (require.main === module) {
  main().catch((error) => {
    console.error(`NASDAQ CALIBRATION FAILED: ${error.message}`);
    process.exitCode = 1;
  });
}
