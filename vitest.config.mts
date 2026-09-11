import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "text-summary"],
      reportsDirectory: "./coverage",
      include: ["src/services/game.service.ts", "src/services/pedagogy.service.ts"],
      exclude: ["node_modules"],
      all: false,
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
  },
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
});
