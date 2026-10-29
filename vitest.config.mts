import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Database helpers are tested against the development copy (inofarma_next), inside rolled-back transactions
try {
  process.loadEnvFile(".env.local");
} catch {}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
