import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Lets tests import with the same "@/..." paths as the app (see tsconfig.json).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
