import type { Tx } from "./client";

/**
 * Call a Postgres function as `select fn($1, ...)` and return its result. Object
 * and array arguments are JSON-stringified and cast to jsonb (the payload shape
 * the atomic RPCs expect); scalars and null pass through, with their type
 * inferred from the function's signature.
 */
export async function callRpc<T = unknown>(
  tx: Tx,
  fn: string,
  ...args: unknown[]
): Promise<T> {
  const values: unknown[] = [];
  const placeholders = args.map((a, i) => {
    if (a !== null && typeof a === "object") {
      values.push(JSON.stringify(a));
      return `$${i + 1}::jsonb`;
    }
    values.push(a);
    return `$${i + 1}`;
  });
  const { rows } = await tx.query<{ result: T }>(
    `select public.${fn}(${placeholders.join(", ")}) as result`,
    values,
  );
  return rows[0]?.result;
}
