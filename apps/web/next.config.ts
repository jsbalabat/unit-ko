import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // @unitko/shared ships TS source; let Next transpile it so the web app and the
  // API stay on one source-of-truth contract without a separate build step.
  transpilePackages: ["@unitko/shared"],
  // Self-contained server output for a small Docker image (`node server.js` with
  // only the traced runtime deps, instead of `next start` + full node_modules).
  output: "standalone",
  // In a monorepo, point the file tracer at the repo root so workspace deps
  // (e.g. @unitko/shared) are traced into the standalone bundle.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
