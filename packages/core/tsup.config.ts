import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "index": "src/index.ts",
    "leads/index": "src/leads/index.ts",
    "tickets/index": "src/tickets/index.ts"
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  format: ["cjs", "esm"],
  target: "es2022",
  tsconfig: "./tsconfig.build.json"
});
