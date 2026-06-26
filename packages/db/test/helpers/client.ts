import { Pool, type PoolClient } from "pg";

const connectionString =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// One pool per Vitest worker. Each test checks out a client, wraps its work in a
// transaction, and ROLLBACKs — so tests never see each other's rows and the
// seeded database is left exactly as `db:reset` produced it.
const pool = new Pool({ connectionString, max: 4 });

export type Tx = PoolClient;

/**
 * Run `fn` inside a transaction that is always rolled back. The callback receives
 * the transaction-bound client; assert behavior freely — nothing is persisted.
 */
export async function withRollback<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const tx = await pool.connect();
  try {
    await tx.query("begin");
    return await fn(tx);
  } finally {
    await tx.query("rollback");
    tx.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
