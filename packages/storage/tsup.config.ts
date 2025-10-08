import { defineConfig } from "tsup";

const { CI, TSUP_DTS, TSUP_SOURCEMAP, TSUP_MINIFY } = process.env;

const isCI = CI === "true" || CI === "1";

const parseBoolean = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined) {
    return defaultValue;
  }

  return value !== "false" && value !== "0";
};

const dts = parseBoolean(TSUP_DTS, !isCI);
const sourcemap = parseBoolean(TSUP_SOURCEMAP, !isCI);
const minify = parseBoolean(TSUP_MINIFY, false);

export default defineConfig({
  entry: {
    "index": "src/index.ts"
  },
  splitting: false,
  sourcemap,
  clean: true,
  dts,
  minify,
  format: ["cjs", "esm"],
  target: "es2022",
  external: ["@ticketz/core"],
  tsconfig: "./tsconfig.build.json"
});
