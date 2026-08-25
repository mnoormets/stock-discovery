import { describe, expect, it, vi } from 'vitest';

import {
  sendHealthchecksPing,
  sendHealthchecksPingIfComplete,
} from '../../scripts/_healthchecks.cjs';

describe('collect:daily Healthchecks heartbeat', () => {
  const successfulRun = {
    dryRun: false,
    errors: [],
    canonicalRun: { runId: 42, runReused: false },
    todayCanonical: true,
    url: 'https://example.test/ping',
  };

  it('sends a ping after a newly created canonical run is confirmed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await expect(sendHealthchecksPingIfComplete(successfulRun, { fetchImpl })).resolves.toEqual({
      status: 'sent',
      httpStatus: 200,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('sends a ping after an idempotently reused canonical run is confirmed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await expect(sendHealthchecksPingIfComplete({
      ...successfulRun,
      canonicalRun: { runId: 42, runReused: true },
    }, { fetchImpl })).resolves.toEqual({ status: 'sent', httpStatus: 200 });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it.each([
    ['dry-run', { ...successfulRun, dryRun: true }],
    ['step failure', { ...successfulRun, errors: ['runCollection failed'] }],
    ['missing canonical result', { ...successfulRun, canonicalRun: null }],
    ['missing current-day canonical run', { ...successfulRun, todayCanonical: false }],
  ])('does not send a ping on %s', async (_name, input) => {
    const fetchImpl = vi.fn();

    await expect(sendHealthchecksPingIfComplete(input, { fetchImpl })).resolves.toEqual({ status: 'skipped' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends one GET request when configured', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await expect(sendHealthchecksPing('https://example.test/ping', { fetchImpl })).resolves.toEqual({
      status: 'sent',
      httpStatus: 200,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith('https://example.test/ping', expect.objectContaining({ method: 'GET' }));
  });

  it('does not request anything when the URL is not configured', async () => {
    const fetchImpl = vi.fn();

    await expect(sendHealthchecksPing('', { fetchImpl })).resolves.toEqual({ status: 'not_configured' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('warns without failing collection when the ping request fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('network unavailable'));
    const warn = vi.fn();

    await expect(sendHealthchecksPing('https://example.test/ping', { fetchImpl, warn })).resolves.toEqual({
      status: 'failed',
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('collect jaab edukaks'));
  });
});
