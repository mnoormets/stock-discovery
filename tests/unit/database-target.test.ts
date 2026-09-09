import { describe, expect, it } from 'vitest';
import {
  assertDatabaseTarget,
  inspectDatabaseUrl,
  requiredDatabaseUrl,
} from '../../src/lib/database-target.cjs';

describe('database target contract', () => {
  it('accepts Neon only for the golden target', () => {
    expect(assertDatabaseTarget(
      'postgresql://user:secret@ep-example.eu-central-1.aws.neon.tech/neondb?sslmode=require',
      'golden',
    )).toEqual({ target: 'golden', host: 'ep-example.eu-central-1.aws.neon.tech', database: 'neondb' });
    expect(() => assertDatabaseTarget(
      'postgres://discovery:secret@localhost:5433/discovery',
      'golden',
    )).toThrow(/requires a neon\.tech host.*\.env\.local precedence/i);
  });

  it('accepts only explicit local hosts for the local target', () => {
    expect(assertDatabaseTarget(
      'postgres://discovery:secret@db:5432/discovery',
      'local',
    )).toEqual({ target: 'local', host: 'db', database: 'discovery' });
    expect(() => assertDatabaseTarget(
      'postgresql://user:secret@ep-example.neon.tech/neondb',
      'local',
    )).toThrow(/DATABASE_TARGET=local requires/);
  });

  it('allows only disposable database names for the test target', () => {
    expect(assertDatabaseTarget(
      'postgres://discovery:secret@localhost:5433/discovery_test',
      'test',
    ).database).toBe('discovery_test');
    expect(assertDatabaseTarget(
      'postgres://discovery:secret@localhost:5433/schema_diff_tmp',
      'test',
    ).database).toBe('schema_diff_tmp');
    expect(() => assertDatabaseTarget(
      'postgres://discovery:secret@localhost:5433/discovery',
      'test',
    )).toThrow(/ending in _test or _tmp/);
  });

  it('requires explicit target intent and a valid PostgreSQL URL', () => {
    expect(() => requiredDatabaseUrl({})).toThrow(/DATABASE_URL is required/);
    expect(() => requiredDatabaseUrl({ DATABASE_URL: 'postgres://localhost/discovery' })).toThrow(/DATABASE_TARGET is required/);
    expect(() => inspectDatabaseUrl('not-a-url')).toThrow(/DATABASE_URL is invalid/);
    expect(() => inspectDatabaseUrl('https://example.com/db')).toThrow(/must use postgres/);
  });

  it('never exposes credentials in mismatch errors', () => {
    let message = '';
    try {
      assertDatabaseTarget('postgres://private-user:super-secret@localhost:5433/discovery', 'golden');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('localhost');
    expect(message).not.toContain('private-user');
    expect(message).not.toContain('super-secret');
  });
});
