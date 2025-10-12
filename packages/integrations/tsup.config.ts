import { defineConfig } from "tsup";

const { CI, TSUP_SOURCEMAP, TSUP_MINIFY } = process.env;

const isCI = CI === "true" || CI === "1";

const parseBoolean = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined) {
    return defaultValue;
  }

  return value !== "false" && value !== "0";
};

const sourcemap = parseBoolean(TSUP_SOURCEMAP, !isCI);
const minify = parseBoolean(TSUP_MINIFY, false);

export default defineConfig({
  entry: {
    "index": "src/index.ts"
  },
  splitting: false,
  sourcemap,
  clean: true,
  dts: true,
  minify,
  format: ["esm"],
  outExtension: () => ({
    js: ".mjs"
  }),
  target: "es2022",
  external: ["@whiskeysockets/baileys", "@hapi/boom"],
  tsconfig: "./tsconfig.build.json"
});
