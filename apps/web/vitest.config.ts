import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Specs import through the same "@/..." alias as the app. That alias lives in
// tsconfig paths, which Vite doesn't read — mirror it here so a spec and the
// module it tests resolve to the same file.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
