import { describe, expect, it } from "vitest";
import type { Tx } from "./helpers/client";
import { withRollback } from "./helpers/client";
import { seedLandlord } from "./helpers/fixtures";

// The activity feed (ActivityRepository.findByLandlord in apps/api) pages by keyset
// on (created_at desc, id desc): each page asks for rows strictly older than the
// last row's (created_at, id). This proves that predicate walks every row exactly
// once — including a run that shares one timestamp, where a created_at-only cursor
// would skip or duplicate rows at the page boundary. Keep the SQL below in step
// with the repository's `.or(created_at.lt.…, and(created_at.eq.…, id.lt.…))`.

const PAGE = 2;

async function pageOnce(
  tx: Tx,
  landlordId: string,
  cursor: { createdAt: string; id: string } | null,
): Promise<{ id: string; created_at: string }[]> {
  const { rows } = await tx.query<{ id: string; created_at: string }>(
    `select id, created_at::text as created_at
     from public.activity_logs
     where user_id = $1
       and (
         $2::timestamptz is null
         or created_at < $2::timestamptz
         or (created_at = $2::timestamptz and id < $3::uuid)
       )
     order by created_at desc, id desc
     limit ${PAGE}`,
    [landlordId, cursor?.createdAt ?? null, cursor?.id ?? null],
  );
  return rows;
}

describe("activity feed keyset pagination", () => {
  it("pages through every row exactly once across a timestamp tie", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { rows: codeRows } = await tx.query<{ code: string }>(
        `select code from public.activity_action_types limit 1`,
      );
      const actionCode = codeRows[0].code;

      // Six logs: one newest, three sharing the middle timestamp (the tie), two
      // oldest — so pages of two straddle both same-timestamp runs.
      const timestamps = [
        "2026-08-03T10:00:00Z",
        "2026-08-02T10:00:00Z",
        "2026-08-02T10:00:00Z",
        "2026-08-02T10:00:00Z",
        "2026-08-01T10:00:00Z",
        "2026-08-01T10:00:00Z",
      ];
      for (const ts of timestamps) {
        await tx.query(
          `insert into public.activity_logs (user_id, action_type_code, description, created_at)
           values ($1, $2, 'seed', $3::timestamptz)`,
          [landlordId, actionCode, ts],
        );
      }

      // The canonical full ordering the paginated walk must reproduce.
      const { rows: ordered } = await tx.query<{ id: string }>(
        `select id from public.activity_logs
         where user_id = $1 order by created_at desc, id desc`,
        [landlordId],
      );
      const expectedIds = ordered.map((r) => r.id);
      expect(expectedIds).toHaveLength(6);

      // Walk the feed page by page, taking the cursor straight from the last row of
      // each page — exactly how the web client drives "Load more".
      const seen: string[] = [];
      let cursor: { createdAt: string; id: string } | null = null;
      for (let guard = 0; guard < 10; guard++) {
        const page = await pageOnce(tx, landlordId, cursor);
        if (page.length === 0) break;
        seen.push(...page.map((r) => r.id));
        const last = page[page.length - 1];
        cursor = { createdAt: last.created_at, id: last.id };
        if (page.length < PAGE) break;
      }

      // Every row once, in the exact global order — no skip, no duplicate at the tie.
      expect(seen).toEqual(expectedIds);
      expect(new Set(seen).size).toBe(seen.length);
    });
  });
});
