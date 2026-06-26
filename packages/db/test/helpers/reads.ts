import type { Tx } from "./client";

export async function readStatus(tx: Tx, entryId: string): Promise<string> {
  const { rows } = await tx.query<{ status_code: string }>(
    `select status_code from public.billing_entries where id = $1`,
    [entryId],
  );
  return rows[0].status_code;
}
