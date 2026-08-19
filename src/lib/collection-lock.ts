import type { PoolClient } from 'pg';

export const COLLECTION_ADVISORY_LOCK_NAME = 'stock-discovery:collect-daily';

export async function tryAcquireCollectionLock(client: Pick<PoolClient, 'query'>): Promise<boolean> {
  const result = await client.query(
    'SELECT pg_try_advisory_lock(hashtext($1)) AS ok',
    [COLLECTION_ADVISORY_LOCK_NAME],
  );
  return result.rows[0]?.ok === true;
}

export async function releaseCollectionLock(client: Pick<PoolClient, 'query'>): Promise<void> {
  await client.query(
    'SELECT pg_advisory_unlock(hashtext($1))',
    [COLLECTION_ADVISORY_LOCK_NAME],
  );
}
