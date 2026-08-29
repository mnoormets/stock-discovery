export const TODAY_INSIDER_EVIDENCE_VERSION = 'form4-card-evidence-v1';

export interface TodayInsiderOwner {
  ownerName: string;
  ownerCik: string | null;
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
  isOther: boolean;
  hasNoDeclaredRole: boolean;
  officerTitle: string | null;
  otherText: string | null;
}

export interface TodayInsiderTransaction {
  transactionId: string;
  accessionNumber: string;
  formType: '4';
  filedDate: string;
  transactionDate: string | null;
  securityTitle: string | null;
  shares: string | null;
  reportedPricePerShare: string | null;
  derivedNotional: string | null;
  derivedNotionalMethod: string | null;
  filingUrl: string;
  rule10b51: boolean | null;
  owners: TodayInsiderOwner[];
}

export type TodayInsiderEvidence =
  | {
    state: 'complete';
    evidenceVersion: typeof TODAY_INSIDER_EVIDENCE_VERSION;
    policyVersion: string;
    sourceFiledDate: string;
    transactions: TodayInsiderTransaction[];
  }
  | {
    state: 'legacy' | 'malformed';
    evidenceVersion: string | null;
    policyVersion: string | null;
    sourceFiledDate: string | null;
    transactions: [];
  };

function recordValue(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nullableString(value: unknown): string | null | undefined {
  return value === null ? null : typeof value === 'string' ? value : undefined;
}

function dateOnly(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function nullableDateOnly(value: unknown): string | null | undefined {
  return value === null ? null : dateOnly(value) || undefined;
}

function decimalString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value) ? value : undefined;
}

function secFilingUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'sec.gov' || url.hostname.endsWith('.sec.gov'))
      ? value
      : null;
  } catch {
    return null;
  }
}

function parseOwner(value: unknown): TodayInsiderOwner | null {
  const owner = recordValue(value);
  if (!owner || typeof owner.ownerName !== 'string' || !owner.ownerName.trim()) return null;
  const ownerCik = nullableString(owner.ownerCik);
  const officerTitle = nullableString(owner.officerTitle);
  const otherText = nullableString(owner.otherText);
  if (ownerCik === undefined || officerTitle === undefined || otherText === undefined) return null;
  const flags = [
    owner.isDirector,
    owner.isOfficer,
    owner.isTenPercentOwner,
    owner.isOther,
    owner.hasNoDeclaredRole,
  ];
  if (!flags.every((flag) => typeof flag === 'boolean')) return null;
  if (!flags.some(Boolean)) return null;
  return {
    ownerName: owner.ownerName,
    ownerCik,
    isDirector: owner.isDirector as boolean,
    isOfficer: owner.isOfficer as boolean,
    isTenPercentOwner: owner.isTenPercentOwner as boolean,
    isOther: owner.isOther as boolean,
    hasNoDeclaredRole: owner.hasNoDeclaredRole as boolean,
    officerTitle,
    otherText,
  };
}

function parseTransaction(value: unknown): TodayInsiderTransaction | null {
  const transaction = recordValue(value);
  if (!transaction || transaction.formType !== '4') return null;
  const filedDate = dateOnly(transaction.filedDate);
  const transactionDate = nullableDateOnly(transaction.transactionDate);
  const securityTitle = nullableString(transaction.securityTitle);
  const shares = decimalString(transaction.shares);
  const reportedPricePerShare = decimalString(transaction.reportedPricePerShare);
  const derivedNotional = decimalString(transaction.derivedNotional);
  const derivedNotionalMethod = nullableString(transaction.derivedNotionalMethod);
  const filingUrl = secFilingUrl(transaction.filingUrl);
  const owners = Array.isArray(transaction.owners) ? transaction.owners.map(parseOwner) : [];
  if (
    typeof transaction.transactionId !== 'string' || !transaction.transactionId
    || typeof transaction.accessionNumber !== 'string' || !transaction.accessionNumber
    || !filedDate || transactionDate === undefined || securityTitle === undefined
    || shares === undefined || reportedPricePerShare === undefined || derivedNotional === undefined
    || derivedNotionalMethod === undefined || !filingUrl
    || (transaction.rule10b51 !== null && typeof transaction.rule10b51 !== 'boolean')
    || owners.length === 0 || owners.some((owner) => owner == null)
    || (derivedNotional == null) !== (derivedNotionalMethod == null)
    || (derivedNotionalMethod != null
      && derivedNotionalMethod !== 'transaction_shares_x_transaction_price_per_share')
  ) return null;
  return {
    transactionId: transaction.transactionId,
    accessionNumber: transaction.accessionNumber,
    formType: '4',
    filedDate,
    transactionDate,
    securityTitle,
    shares,
    reportedPricePerShare,
    derivedNotional,
    derivedNotionalMethod,
    filingUrl,
    rule10b51: transaction.rule10b51 as boolean | null,
    owners: owners as TodayInsiderOwner[],
  };
}

export function parseTodayInsiderEvidence(rawSignal: unknown): TodayInsiderEvidence | null {
  const root = recordValue(rawSignal);
  const insider = recordValue(root?.insider);
  if (!insider) return null;

  const evidenceVersion = typeof insider.evidenceVersion === 'string' ? insider.evidenceVersion : null;
  const policyVersion = typeof insider.policyVersion === 'string' ? insider.policyVersion : null;
  const sourceFiledDate = dateOnly(insider.sourceFiledDate);
  if (!evidenceVersion) {
    return { state: 'legacy', evidenceVersion: null, policyVersion, sourceFiledDate, transactions: [] };
  }
  if (
    evidenceVersion !== TODAY_INSIDER_EVIDENCE_VERSION
    || policyVersion !== 'form4-insider-selection-v1'
    || !sourceFiledDate
    || !Array.isArray(insider.transactions)
    || insider.transactions.length === 0
  ) {
    return { state: 'malformed', evidenceVersion, policyVersion, sourceFiledDate, transactions: [] };
  }
  const transactions = insider.transactions.map(parseTransaction);
  if (transactions.some((transaction) => transaction == null)) {
    return { state: 'malformed', evidenceVersion, policyVersion, sourceFiledDate, transactions: [] };
  }
  return {
    state: 'complete',
    evidenceVersion: TODAY_INSIDER_EVIDENCE_VERSION,
    policyVersion,
    sourceFiledDate,
    transactions: transactions as TodayInsiderTransaction[],
  };
}
