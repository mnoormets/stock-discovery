function shouldSendHealthchecksPing({ dryRun, errors, canonicalRun, todayCanonical }) {
  return !dryRun && errors.length === 0 && canonicalRun != null && todayCanonical === true;
}

async function sendHealthchecksPing(url, { fetchImpl = globalThis.fetch, warn = console.warn } = {}) {
  if (!url) return { status: 'not_configured' };

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { status: 'sent', httpStatus: response.status };
  } catch (error) {
    const detail = error instanceof Error ? error.name : 'UnknownError';
    warn(`Healthchecks heartbeat ebaonnestus (${detail}); collect jaab edukaks.`);
    return { status: 'failed' };
  }
}

async function sendHealthchecksPingIfComplete(input, dependencies) {
  if (!shouldSendHealthchecksPing(input)) return { status: 'skipped' };
  return sendHealthchecksPing(input.url, dependencies);
}

module.exports = { shouldSendHealthchecksPing, sendHealthchecksPing, sendHealthchecksPingIfComplete };
