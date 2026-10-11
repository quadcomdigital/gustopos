/**
 * Test-only bootstrap: import this FIRST from any test that (transitively)
 * loads the DB client.
 *
 * `db/client.ts` throws at module load when `DATABASE_URL` is missing, while a
 * unit test must never open a connection. The pg pool is lazy — it connects on
 * the first query — so a dummy URL satisfies the check and touches nothing.
 */
process.env.DATABASE_URL ??= "postgresql://test@127.0.0.1:5432/gustopos";

export {};
