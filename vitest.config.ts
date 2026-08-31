import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // Pure-logic tests (the vast majority) stay on the faster "node"
    // environment; component tests opt into jsdom individually via a
    // `// @vitest-environment jsdom` docblock at the top of the file,
    // rather than paying jsdom's overhead for every test in the suite.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
