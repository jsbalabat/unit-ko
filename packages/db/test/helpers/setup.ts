import { afterAll } from "vitest";
import { closePool } from "./client";

// Vitest isolates module state per test file, so each file owns its pool; close
// it once the file's tests finish or the worker process would hang on the open
// connections.
afterAll(async () => {
  await closePool();
});
