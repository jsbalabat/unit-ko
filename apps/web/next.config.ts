import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @unitko/shared ships TS source; let Next transpile it so the web app and the
  // API stay on one source-of-truth contract without a separate build step.
  transpilePackages: ["@unitko/shared"],
};

export default nextConfig;
