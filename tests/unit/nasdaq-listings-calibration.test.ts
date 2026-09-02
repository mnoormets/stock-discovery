import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const {
  classifyDirectorySecurity,
  classifyTradingEvent,
  diffDirectories,
  parseAddsDeletes,
  parseNasdaqListed,
} = await import('../../scripts/_nasdaq-listings.cjs');
const { buildReport, parseArgs, writeArtifacts } = await import('../../scripts/calibrate-nasdaq-listings.cjs');

const listed = (rows: string[]) => [
  'Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares',
  ...rows,
  'File Creation Time: 0902202603:02|||||||',
].join('\n');

const actions = (rows: string[]) => [
  'Symbol|Company Name|NASDAQ Action|BX Action|PSX Action|Effective Date|Primary Listing Market',
  ...rows,
  'File Creation Time: 0902202603:04|||||',
].join('\n');

describe('Nasdaq listing calibration', () => {
  it('parses the exact live directory contract and preserves source freshness without inventing a timezone', () => {
    const parsed = parseNasdaqListed(listed([
      'GOOD|Example Corp - Common Stock|Q|N|N|100|N|N',
      'ADRX|Foreign Corp - American Depositary Shares|G|N|N|100|N|N',
    ]));
    expect(parsed.fileCreation).toEqual({ raw: '0902202603:02', date: '2026-09-02', time: '03:02', timeZone: null });
    expect(parsed.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.rows[0]).toMatchObject({ symbol: 'GOOD', marketCategory: 'Q', roundLotSize: 100, etf: 'N' });
    expect(classifyDirectorySecurity(parsed.rows[1])).toEqual({ instrumentKind: 'ads', eligibility: 'lookup_ready', reasons: [] });
  });

  it('fails closed when a source header or row contract changes', () => {
    expect(() => parseNasdaqListed('Symbol|Changed\nFile Creation Time: 0902202603:02|')).toThrow(/päis muutus/);
    expect(() => parseNasdaqListed(listed(['BAD|Too few fields|Q|N']))).toThrow(/oodati 8/);
    expect(() => parseAddsDeletes(actions(['BAD|Corp|Rename|||9/2/2026|Q']))).toThrow(/tundmatu NASDAQ action/);
  });

  it('preserves all exclusion reasons and keeps SPAC common shares radar-only', () => {
    const [warrant, spac, troubled] = parseNasdaqListed(listed([
      'WARR|Example Corp - Warrants|S|N|N|100|N|N',
      'SPAC|Example Acquisition Corp - Class A Ordinary Shares|S|N|N|100|N|N',
      'RISK|Risk Fund ETF|G|Y|D|100|Y|Y',
    ])).rows;
    expect(classifyDirectorySecurity(warrant)).toEqual({ instrumentKind: 'warrant', eligibility: 'excluded', reasons: ['instrument_warrant'] });
    expect(classifyDirectorySecurity(spac)).toEqual({ instrumentKind: 'spac', eligibility: 'radar_only', reasons: ['spac_or_blank_check'] });
    expect(classifyDirectorySecurity(troubled)).toEqual({
      instrumentKind: 'fund', eligibility: 'excluded',
      reasons: ['test_issue', 'etf', 'nextshares', 'financial_status_D', 'instrument_fund'],
    });
  });

  it('requires Nasdaq-primary Add plus directory confirmation before lookup readiness', () => {
    const rows = parseNasdaqListed(listed([
      'GOOD|Example Corp - Common Stock|Q|N|N|100|N|N',
      'SPAC|Example Acquisition Corp - Class A Ordinary Shares|S|N|N|100|N|N',
    ])).rows;
    const directory = new Map(rows.map((row: { symbol: string }) => [row.symbol, row]));
    const parsedActions = parseAddsDeletes(actions([
      'GOOD|Example Corp|Add|Add|Add|9/2/2026|Q',
      'WAIT|Waiting Corp|Add|Add|Add|9/2/2026|G',
      'OTHER|Other ETF|Add|Add|Add|9/2/2026|P',
      'SPAC|Example Acquisition Corp|Add|Add|Add|9/2/2026|S',
      'OLD|Old Corp|Delete|Delete|Delete|9/2/2026|Q',
    ])).rows;
    expect(classifyTradingEvent(parsedActions[0], directory).status).toBe('lookup_ready');
    expect(classifyTradingEvent(parsedActions[1], directory).status).toBe('pending_directory_confirmation');
    expect(classifyTradingEvent(parsedActions[2], directory).reasons).toEqual(['not_nasdaq_primary_listing']);
    expect(classifyTradingEvent(parsedActions[3], directory).status).toBe('radar_only');
    expect(classifyTradingEvent(parsedActions[4], directory).status).toBe('not_add');
  });

  it('treats the first complete directory as baseline and diffs only against an explicit prior snapshot', () => {
    const previous = parseNasdaqListed(listed([
      'SAME|Same Corp - Common Stock|Q|N|N|100|N|N',
      'GONE|Gone Corp - Common Stock|G|N|N|100|N|N',
      'CHNG|Changed Corp - Common Stock|S|N|N|100|N|N',
    ])).rows;
    const current = parseNasdaqListed(listed([
      'SAME|Same Corp - Common Stock|Q|N|N|100|N|N',
      'NEW|New Corp - Common Stock|G|N|N|100|N|N',
      'CHNG|Changed Corp - Class A Common Stock|S|N|N|100|N|N',
    ])).rows;
    expect(diffDirectories(null, current)).toMatchObject({ baselineExisting: 3, added: [], removed: [], changed: [] });
    const diff = diffDirectories(previous, current);
    expect(diff.added.map((row: { symbol: string }) => row.symbol)).toEqual(['NEW']);
    expect(diff.removed.map((row: { symbol: string }) => row.symbol)).toEqual(['GONE']);
    expect(diff.changed.map((row: { symbol: string }) => row.symbol)).toEqual(['CHNG']);
  });

  it('reports a versioned, database-free calibration funnel', () => {
    const directory = parseNasdaqListed(listed([
      'GOOD|Example Corp - Common Stock|Q|N|N|100|N|N',
      'SPAC|Example Acquisition Corp - Class A Ordinary Shares|S|N|N|100|N|N',
      'FUND|Example ETF|G|N|N|100|Y|N',
    ]));
    const eventFile = parseAddsDeletes(actions([
      'GOOD|Example Corp|Add|Add|Add|9/2/2026|Q',
      'WAIT|Waiting Corp|Add|Add|Add|9/2/2026|G',
    ]));
    const report = buildReport(directory, eventFile, null, new Date('2026-09-02T08:00:00Z'));
    expect(report).toMatchObject({
      schemaVersion: 'nasdaq-listing-calibration-v1',
      policyVersion: 'nasdaq-new-listing-observation-v1',
      directory: { total: 3, basicEligible: 2, lookupReady: 1, radarOnly: 1, excluded: 1 },
      events: { counts: { total: 2, lookupReady: 1, pendingDirectoryConfirmation: 1 } },
      diff: { previousProvided: false, baselineExisting: 3 },
    });
  });

  it('validates CLI arguments and has no database dependency or mutation path', () => {
    expect(parseArgs([])).toEqual({ artifactDir: null, json: false, previous: null });
    expect(parseArgs(['--json', '--previous', 'prior.txt', '--artifact-dir', 'out'])).toEqual({
      artifactDir: 'out', json: true, previous: 'prior.txt',
    });
    expect(() => parseArgs(['--previous'])).toThrow(/vajab/);
    expect(() => parseArgs(['--artifact-dir'])).toThrow(/vajab/);
    const moduleSource = fs.readFileSync('scripts/_nasdaq-listings.cjs', 'utf8');
    const cliSource = fs.readFileSync('scripts/calibrate-nasdaq-listings.cjs', 'utf8');
    for (const source of [moduleSource, cliSource]) {
      expect(source).not.toContain("require('pg')");
      expect(source).not.toContain('DATABASE_URL');
      expect(source).not.toContain('pool.query');
    }
  });

  it('writes exact raw source payloads and a versioned JSON observation artifact', () => {
    const directoryText = listed(['GOOD|Example Corp - Common Stock|Q|N|N|100|N|N']);
    const actionsText = actions(['GOOD|Example Corp|Add|Add|Add|9/2/2026|Q']);
    const report = buildReport(
      parseNasdaqListed(directoryText),
      parseAddsDeletes(actionsText),
      null,
      new Date('2026-09-02T08:00:00Z'),
    );
    const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdaq-observation-'));
    try {
      const files = writeArtifacts(artifactDir, directoryText, actionsText, report);
      expect(fs.readFileSync(files.nasdaqListed, 'utf8')).toBe(directoryText);
      expect(fs.readFileSync(files.addsDeletes, 'utf8')).toBe(actionsText);
      expect(JSON.parse(fs.readFileSync(files.report, 'utf8'))).toMatchObject({
        schemaVersion: 'nasdaq-listing-calibration-v1',
        policyVersion: 'nasdaq-new-listing-observation-v1',
        source: {
          nasdaqListed: { contentSha256: parseNasdaqListed(directoryText).contentSha256 },
          addsDeletes: { contentSha256: parseAddsDeletes(actionsText).contentSha256 },
        },
      });
    } finally {
      fs.rmSync(artifactDir, { recursive: true, force: true });
    }
  });
});
