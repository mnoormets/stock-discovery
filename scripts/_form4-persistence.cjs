// Atomic PostgreSQL persistence for parsed SEC Form 4 ownership documents.
// This is script-only infrastructure and is not imported by the production collector.

const AMENDMENT_LINK_METHOD = 'issuer_original_date_period_owner_set_v1';

function boundedError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 2000);
}

function filingIdentity(indexRow, parsed = {}) {
  const accessionNumber = parsed.accessionNumber || indexRow.accessionNumber;
  const formType = parsed.formType || indexRow.form;
  const issuerCik = parsed.issuerCik || indexRow.cik;
  const issuerName = parsed.issuerName || indexRow.companyName;
  if (!accessionNumber || !formType || !issuerCik || !issuerName || !indexRow.filedDate || !indexRow.url) {
    throw new Error('Form 4 filing identity on puudulik.');
  }
  return { accessionNumber, formType, issuerCik, issuerName };
}

async function recordFilingAttempt(database, indexRow) {
  const identity = filingIdentity(indexRow);
  const result = await database.query(
    `INSERT INTO insider_filings (
       accession_number, form_type, issuer_cik, issuer_name, filed_date,
       sec_submission_url, amendment_link_status, ingestion_status,
       ingestion_attempt_count, last_attempted_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,'discovered',1,now())
     ON CONFLICT (accession_number) DO UPDATE SET
       ingestion_attempt_count = insider_filings.ingestion_attempt_count + 1,
       last_attempted_at = now(),
       retry_after = NULL,
       last_error = NULL,
       updated_at = now()
     WHERE insider_filings.ingestion_status <> 'persisted'
     RETURNING id, accession_number, ingestion_status, ingestion_attempt_count`,
    [
      identity.accessionNumber,
      identity.formType,
      identity.issuerCik,
      identity.issuerName,
      indexRow.filedDate,
      indexRow.url,
      identity.formType === '4/A' ? 'unresolved' : 'not_applicable',
    ],
  );
  if (result.rowCount) return { ...result.rows[0], skipped: false };
  const existing = await database.query(
    `SELECT id, accession_number, ingestion_status, ingestion_attempt_count
       FROM insider_filings WHERE accession_number = $1`,
    [identity.accessionNumber],
  );
  return { ...existing.rows[0], skipped: true };
}

async function markFilingFailure(database, accessionNumber, status, error, retryAfter = null) {
  if (!['fetch_failed', 'parse_failed', 'persist_failed'].includes(status)) {
    throw new Error(`Vigane Form 4 failure status: ${status}`);
  }
  await database.query(
    `UPDATE insider_filings
        SET ingestion_status = $2,
            last_error = $3,
            retry_after = $4,
            updated_at = now()
      WHERE accession_number = $1 AND ingestion_status <> 'persisted'`,
    [accessionNumber, status, boundedError(error), retryAfter],
  );
}

function ownerRoleSummary(owners) {
  if (!owners.length) throw new Error('Form 4 filingul puudub reportingOwner.');
  return {
    count: owners.length,
    director: owners.some((owner) => owner.director),
    officer: owners.some((owner) => owner.officer),
    tenPercentOwner: owners.some((owner) => owner.tenPercentOwner),
    other: owners.some((owner) => owner.other),
    noDeclaredRole: owners.some((owner) => !owner.director && !owner.officer && !owner.tenPercentOwner && !owner.other),
  };
}

function ownerFingerprint(owners) {
  return owners
    .map((owner) => owner.owner_cik ? `cik:${owner.owner_cik}` : `name:${String(owner.owner_name || '').trim().toUpperCase()}`)
    .sort()
    .join('|');
}

async function reconcileAmendmentsForIssuer(client, issuerCik) {
  const filingResult = await client.query(
    `SELECT id, form_type, filed_date::text, period_of_report::text,
            date_of_original_submission::text
       FROM insider_filings
      WHERE issuer_cik = $1 AND ingestion_status = 'persisted'
      ORDER BY filed_date, id`,
    [issuerCik],
  );
  if (!filingResult.rowCount) return { resolved: 0, unresolved: 0, ambiguous: 0 };
  const ids = filingResult.rows.map((row) => Number(row.id));
  const ownerResult = await client.query(
    `SELECT filing_id, owner_cik, owner_name
       FROM insider_reporting_owners
      WHERE filing_id = ANY($1::bigint[])
      ORDER BY filing_id, owner_row_key`,
    [ids],
  );
  const ownersByFiling = new Map();
  for (const owner of ownerResult.rows) {
    const key = Number(owner.filing_id);
    const values = ownersByFiling.get(key) || [];
    values.push(owner);
    ownersByFiling.set(key, values);
  }
  const originals = filingResult.rows.filter((row) => row.form_type === '4');
  const amendments = filingResult.rows.filter((row) => row.form_type === '4/A');
  const counts = { resolved: 0, unresolved: 0, ambiguous: 0 };
  for (const amendment of amendments) {
    const amendmentOwners = ownerFingerprint(ownersByFiling.get(Number(amendment.id)) || []);
    const matches = amendment.date_of_original_submission ? originals.filter((original) => (
      original.filed_date === amendment.date_of_original_submission
      && (!amendment.period_of_report || !original.period_of_report || original.period_of_report === amendment.period_of_report)
      && ownerFingerprint(ownersByFiling.get(Number(original.id)) || []) === amendmentOwners
    )) : [];
    const status = matches.length === 1 ? 'resolved' : matches.length > 1 ? 'ambiguous' : 'unresolved';
    const originalId = status === 'resolved' ? Number(matches[0].id) : null;
    await client.query(
      `UPDATE insider_filings
          SET amends_filing_id = $2,
              amendment_link_status = $3,
              amendment_link_method = $4,
              updated_at = now()
        WHERE id = $1`,
      [Number(amendment.id), originalId, status, status === 'resolved' ? AMENDMENT_LINK_METHOD : null],
    );
    counts[status] += 1;
  }
  return counts;
}

async function insertOwners(client, filingId, owners) {
  for (const owner of owners) {
    await client.query(
      `INSERT INTO insider_reporting_owners (
         filing_id, owner_row_key, owner_cik, owner_name,
         is_director, is_officer, is_ten_percent_owner, is_other,
         officer_title, other_text
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        filingId, owner.rowKey, owner.cik, owner.name,
        owner.director, owner.officer, owner.tenPercentOwner, owner.other,
        owner.officerTitle, owner.otherText,
      ],
    );
  }
}

async function insertTransactions(client, filingId, transactions, roles) {
  let footnoteCount = 0;
  for (const transaction of transactions) {
    const result = await client.query(
      `INSERT INTO insider_transactions (
         filing_id, transaction_row_key, security_kind, transaction_date,
         deemed_execution_date, security_title, transaction_form_type,
         transaction_code, acquired_disposed_code, transaction_timeliness,
         equity_swap_involved, rule_10b5_1, transaction_shares,
         transaction_price_per_share, post_transaction_shares,
         direct_or_indirect_ownership, nature_of_ownership,
         conversion_or_exercise_price, exercise_date, expiration_date,
         underlying_security_title, underlying_security_shares,
         reporting_owner_count, filing_has_director_owner,
         filing_has_officer_owner, filing_has_ten_percent_owner,
         filing_has_other_owner, filing_has_owner_without_declared_role
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
         $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
       ) RETURNING id`,
      [
        filingId, transaction.rowKey, transaction.securityKind, transaction.date,
        transaction.deemedExecutionDate, transaction.securityTitle,
        transaction.transactionFormType, transaction.code, transaction.acquiredDisposed,
        transaction.transactionTimeliness, transaction.equitySwapInvolved,
        transaction.rule10b5One, transaction.shares, transaction.price,
        transaction.postTransactionShares, transaction.directOrIndirectOwnership,
        transaction.natureOfOwnership, transaction.conversionOrExercisePrice,
        transaction.exerciseDate, transaction.expirationDate,
        transaction.underlyingSecurityTitle, transaction.underlyingSecurityShares,
        roles.count, roles.director, roles.officer, roles.tenPercentOwner,
        roles.other, roles.noDeclaredRole,
      ],
    );
    const transactionId = Number(result.rows[0].id);
    for (const footnote of transaction.footnotes || []) {
      await client.query(
        `INSERT INTO insider_transaction_footnotes
           (transaction_id, field_name, footnote_id, footnote_text)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING`,
        [transactionId, footnote.fieldName, footnote.id, footnote.text],
      );
      footnoteCount += 1;
    }
  }
  return footnoteCount;
}

async function persistForm4Filing(database, indexRow, parsed) {
  const identity = filingIdentity(indexRow, parsed);
  const client = await database.connect();
  let began = false;
  try {
    await client.query('BEGIN');
    began = true;
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`stock-discovery:form4:${identity.accessionNumber}`]);
    const existing = await client.query(
      `SELECT id, ingestion_status FROM insider_filings WHERE accession_number = $1 FOR UPDATE`,
      [identity.accessionNumber],
    );
    if (existing.rows[0]?.ingestion_status === 'persisted') {
      await client.query('COMMIT');
      began = false;
      return { filingId: Number(existing.rows[0].id), accessionNumber: identity.accessionNumber, created: false, skipped: true };
    }

    const filingResult = await client.query(
      `INSERT INTO insider_filings (
         accession_number, form_type, issuer_cik, issuer_ticker, issuer_name,
         filed_date, accepted_at, period_of_report, date_of_original_submission,
         sec_submission_url, sec_primary_document_url, schema_version,
         parser_version, ownership_xml_sha256, amendment_link_status,
         ingestion_status, ingestion_attempt_count, last_attempted_at,
         retry_after, last_error, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7::timestamp AT TIME ZONE 'America/New_York',$8,$9,$10,$11,$12,$13,$14,$15,
         'discovered',1,now(),NULL,NULL,now()
       )
       ON CONFLICT (accession_number) DO UPDATE SET
         form_type = EXCLUDED.form_type,
         issuer_cik = EXCLUDED.issuer_cik,
         issuer_ticker = EXCLUDED.issuer_ticker,
         issuer_name = EXCLUDED.issuer_name,
         filed_date = EXCLUDED.filed_date,
         accepted_at = EXCLUDED.accepted_at,
         period_of_report = EXCLUDED.period_of_report,
         date_of_original_submission = EXCLUDED.date_of_original_submission,
         sec_submission_url = EXCLUDED.sec_submission_url,
         sec_primary_document_url = EXCLUDED.sec_primary_document_url,
         schema_version = EXCLUDED.schema_version,
         parser_version = EXCLUDED.parser_version,
         ownership_xml_sha256 = EXCLUDED.ownership_xml_sha256,
         ingestion_status = 'discovered',
         retry_after = NULL,
         last_error = NULL,
         updated_at = now()
       RETURNING id`,
      [
        identity.accessionNumber, identity.formType, identity.issuerCik,
        parsed.issuerTicker, identity.issuerName, indexRow.filedDate,
        parsed.acceptedAt, parsed.periodOfReport, parsed.dateOfOriginalSubmission,
        indexRow.url, parsed.primaryDocumentUrl, parsed.schemaVersion,
        parsed.parserVersion, parsed.ownershipXmlSha256,
        identity.formType === '4/A' ? 'unresolved' : 'not_applicable',
      ],
    );
    const filingId = Number(filingResult.rows[0].id);
    const childCounts = await client.query(
      `SELECT
         (SELECT count(*)::int FROM insider_reporting_owners WHERE filing_id = $1) AS owners,
         (SELECT count(*)::int FROM insider_transactions WHERE filing_id = $1) AS transactions`,
      [filingId],
    );
    if (childCounts.rows[0].owners || childCounts.rows[0].transactions) {
      throw new Error(`Mitte-persisted accession ${identity.accessionNumber} sisaldab ootamatuid child-ridu.`);
    }

    const roles = ownerRoleSummary(parsed.owners || []);
    await insertOwners(client, filingId, parsed.owners);
    const footnoteCount = await insertTransactions(client, filingId, parsed.transactions || [], roles);
    await client.query(
      `UPDATE insider_filings
          SET ingestion_status = 'persisted', ingested_at = now(),
              retry_after = NULL, last_error = NULL, updated_at = now()
        WHERE id = $1`,
      [filingId],
    );
    const amendmentLinks = await reconcileAmendmentsForIssuer(client, identity.issuerCik);
    await client.query('COMMIT');
    began = false;
    return {
      filingId,
      accessionNumber: identity.accessionNumber,
      created: true,
      skipped: false,
      ownerCount: roles.count,
      transactionCount: (parsed.transactions || []).length,
      footnoteCount,
      amendmentLinks,
    };
  } catch (error) {
    if (began) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  AMENDMENT_LINK_METHOD,
  markFilingFailure,
  ownerRoleSummary,
  persistForm4Filing,
  reconcileAmendmentsForIssuer,
  recordFilingAttempt,
};
