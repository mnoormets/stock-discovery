# SEC Form 4 calibration report

Generated: 2026-08-22T21:39:24.783Z

Coverage: 3 filing days; full population requested for each day; 3639 SEC requests.
Database overlap: 143 companies read with SELECT-only transaction.

## Daily results

| Date | Indexed 4/4A | 4/A | Parsed | Parse failures | P+A filings | P+A tx | Distinct issuers | Usable tickers | Existing-company overlap |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2026-08-21 | 1200 | 4 | 1200/1200 | 0 | 139 | 204 | 56 | 54 | 2 (3.6%) |
| 2026-08-20 | 995 | 20 | 995/995 | 0 | 158 | 299 | 71 | 70 | 3 (4.2%) |
| 2026-08-19 | 1441 | 51 | 1441/1441 | 0 | 142 | 198 | 55 | 54 | 0 (0.0%) |

Counts of purchases and issuers are exact for parsed filings. When the run is sampled rather than full-population, they are sample counts and are not extrapolated.

## 2026-08-21

- Index: 1200 Form 4/4A filings (4 amendments). Parsed 1200/1200; failures 0.
- Qualifying rule: non-derivative transaction code P and acquired/disposed A. 139 filings (11.6%), 204 transactions, 56 distinct issuers.
- Qualifying amendments: 4. Issuers without a usable ticker: 2.
- Price fields: 204 present; 0 missing; 55 footnoted; 149 present and unfootnoted. Footnoted and missing are independent flags.
- Reporting-owner records (roles are multi-label): 186; director 90; officer 60; 10% owner 94; other 24; none declared 0.
- Existing companies overlap: 2/56; 52 usable tickers not currently matched by ticker or SEC CIK.
- Computable transaction notionals (shares × price): n=204; min $126; p10 $2,359; p25 $7,410; median $26,475; p75 $106,950; p90 $487,065; max $324,032,894
- Fully computable issuer-day known-notional sums: n=56; min $756; p10 $9,926; p25 $49,736; median $102,205; p75 $532,798; p90 $1,937,430; max $648,065,788
- Observed schema versions: X0609.

## 2026-08-20

- Index: 995 Form 4/4A filings (20 amendments). Parsed 995/995; failures 0.
- Qualifying rule: non-derivative transaction code P and acquired/disposed A. 158 filings (15.9%), 299 transactions, 71 distinct issuers.
- Qualifying amendments: 4. Issuers without a usable ticker: 1.
- Price fields: 299 present; 0 missing; 144 footnoted; 155 present and unfootnoted. Footnoted and missing are independent flags.
- Reporting-owner records (roles are multi-label): 172; director 114; officer 56; 10% owner 48; other 8; none declared 0.
- Existing companies overlap: 3/71; 67 usable tickers not currently matched by ticker or SEC CIK.
- Computable transaction notionals (shares × price): n=299; min $35; p10 $1,600; p25 $5,780; median $22,000; p75 $159,712; p90 $1,345,923; max $36,353,820
- Fully computable issuer-day known-notional sums: n=71; min $744; p10 $4,396; p25 $12,672; median $49,949; p75 $256,348; p90 $1,001,329; max $250,208,812
- Observed schema versions: X0609.

## 2026-08-19

- Index: 1441 Form 4/4A filings (51 amendments). Parsed 1441/1441; failures 0.
- Qualifying rule: non-derivative transaction code P and acquired/disposed A. 142 filings (9.9%), 198 transactions, 55 distinct issuers.
- Qualifying amendments: 0. Issuers without a usable ticker: 1.
- Price fields: 198 present; 0 missing; 66 footnoted; 132 present and unfootnoted. Footnoted and missing are independent flags.
- Reporting-owner records (roles are multi-label): 230; director 136; officer 60; 10% owner 146; other 2; none declared 0.
- Existing companies overlap: 0/55; 54 usable tickers not currently matched by ticker or SEC CIK.
- Computable transaction notionals (shares × price): n=198; min $361; p10 $2,352; p25 $8,358; median $25,120; p75 $162,582; p90 $475,071; max $15,172,500
- Fully computable issuer-day known-notional sums: n=55; min $722; p10 $6,872; p25 $22,100; median $89,373; p75 $531,399; p90 $2,082,014; max $60,690,000
- Observed schema versions: X0609.

## Combined sample

- Parsed 3636/3636 selected filings from 3636 indexed Form 4/4A filings; 0 failed.
- Per-day average: 1212.0 indexed filings; 60.7 qualifying distinct issuers; 59.3 issuers with usable tickers.
- Qualifying filings: 439 (12.1%); qualifying transactions: 701.
- Issuer-day observations: 182; existing-company overlap 5 (2.7%); potentially new usable tickers 173.
- Price present 701; missing 0 (0.0%); footnoted 265 (37.8%); clean 436 (62.2%).
- Owner roles, multi-label: director 340; officer 176; 10% owner 288; other 34; none declared 0.
- All computable transaction notionals: n=701; min $35; p10 $2,117; p25 $6,656; median $25,120; p75 $152,738; p90 $978,658; max $324,032,894

## Method and limitations

- Source: SEC EDGAR daily form indexes and complete filing submission text. The parser extracts the embedded `<ownershipDocument>` XML.
- Purchase means only a non-derivative `P` transaction with acquired/disposed value `A`. `P` means open-market or private purchase; the report does not distinguish the two.
- Amendments are reported separately and are not reconciled to originals in this Phase 1 collector.
- Owner-role counts are not mutually exclusive. One reporting owner can be both director and officer.
- A footnoted numeric price remains computable but is counted as footnoted, not clean. Missing and footnoted are independent flags.
- Company overlap is a point-in-time, read-only match by normalized issuer ticker or SEC CIK. It does not mutate or enrich the database.
- No persistence, discovery selection, score, ranking, candidate, or UI logic is executed.
