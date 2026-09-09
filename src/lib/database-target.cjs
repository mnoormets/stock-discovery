const VALID_TARGETS = new Set(['golden', 'local', 'test']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'db']);
const SCRATCH_DATABASE = /_(test|tmp)$/;

function inspectDatabaseUrl(connectionString) {
  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL is invalid; target validation stopped before connecting.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(`DATABASE_URL must use postgres:// or postgresql://, received ${parsed.protocol || 'unknown protocol'}.`);
  }
  const host = parsed.hostname.toLowerCase();
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, '')).split('/')[0];
  if (!host || !database) {
    throw new Error('DATABASE_URL must include both a host and database name.');
  }
  return { host, database };
}

function assertDatabaseTarget(connectionString, target) {
  if (!target) {
    throw new Error(
      'DATABASE_TARGET is required before opening PostgreSQL. Use golden for Neon, local for an intentional local app, or test for an isolated *_test/*_tmp database.',
    );
  }
  if (!VALID_TARGETS.has(target)) {
    throw new Error(`DATABASE_TARGET must be golden, local, or test; received "${target}".`);
  }
  const details = inspectDatabaseUrl(connectionString);
  if (target === 'golden' && details.host !== 'neon.tech' && !details.host.endsWith('.neon.tech')) {
    throw new Error(
      `DATABASE_TARGET=golden requires a neon.tech host; resolved host is "${details.host}" and database is "${details.database}". Check .env.local precedence.`,
    );
  }
  if (target === 'local' && !LOCAL_HOSTS.has(details.host)) {
    throw new Error(
      `DATABASE_TARGET=local requires localhost, 127.0.0.1, ::1, or db; resolved host is "${details.host}".`,
    );
  }
  if (target === 'test' && !SCRATCH_DATABASE.test(details.database)) {
    throw new Error(
      `DATABASE_TARGET=test requires a database ending in _test or _tmp; resolved database is "${details.database}".`,
    );
  }
  return { target, ...details };
}

/**
 * @param {{ DATABASE_URL?: string, DATABASE_TARGET?: string }} [environment]
 */
function requiredDatabaseUrl(environment = process.env) {
  const connectionString = environment.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required; the application no longer falls back to a local database.');
  }
  assertDatabaseTarget(connectionString, environment.DATABASE_TARGET);
  return connectionString;
}

module.exports = { assertDatabaseTarget, inspectDatabaseUrl, requiredDatabaseUrl };
