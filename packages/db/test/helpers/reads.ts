import type { Tx } from "./client";

// status_code is derived, not stored — read it from the view.
export async function readStatus(tx: Tx, entryId: string): Promise<string> {
  const { rows } = await tx.query<{ status_code: string }>(
    `select status_code from public.v_billing_entries_full where id = $1`,
    [entryId],
  );
  return rows[0].status_code;
}
