import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repo = process.cwd();
const npmrcPath = path.join(repo, ".npmrc");
const vscSettings = path.join(repo, ".vscode", "settings.json");
const pnpmStore = path.join(repo, "node_modules", ".pnpm");
const integrationsPkgJson = path.join(repo, "packages", "integrations", "package.json");

let ok = true;
const fail = (msg) => {
  console.error("❌", msg);
  ok = false;
};
const pass = (msg) => console.log("✅", msg);
const warn = (msg) => console.warn("⚠️", msg);

// 1) .npmrc sanity
if (!fs.existsSync(npmrcPath)) {
  fail("`.npmrc` ausente na raiz.");
} else {
  const txt = fs.readFileSync(npmrcPath, "utf8");
  const expectLine = (re, human) => {
    if (re.test(txt)) {
      pass(human);
    } else {
      fail(`Falta em .npmrc: ${human}`);
    }
  };
  expectLine(/^node-linker\s*=\s*isolated/m, "node-linker=isolated");
  expectLine(/^virtual-store-dir\s*=\s*node_modules\/\.pnpm/m, "virtual-store-dir=node_modules/.pnpm");
  expectLine(/^shared-workspace-lockfile\s*=\s*true/m, "shared-workspace-lockfile=true");
  expectLine(/^strict-peer-dependencies\s*=\s*true/m, "strict-peer-dependencies=true");
  expectLine(/^engine-strict\s*=\s*true/m, "engine-strict=true");
}

// 2) store virtual existe?
if (fs.existsSync(pnpmStore)) {
  pass("store virtual presente em node_modules/.pnpm");
} else {
  fail("store virtual NÃO encontrada em node_modules/.pnpm");
}

// 3) resolve deps a partir do pacote @ticketz/integrations
if (!fs.existsSync(integrationsPkgJson)) {
  fail("packages/integrations/package.json não encontrado.");
} else {
  createRequire(integrationsPkgJson);
  pass("@ticketz/integrations detectado (package.json presente)");
  try {
    const tsFromRepo = createRequire(path.join(repo, "package.json")).resolve("typescript");
    pass(`TypeScript do repo resolvido: ${tsFromRepo}`);
  } catch {
    fail("TypeScript do repo NÃO resolvido (ver devDependencies/root).");
  }
}

// 4) VS Code usando TS do repo?
if (fs.existsSync(vscSettings)) {
  try {
    const settings = JSON.parse(fs.readFileSync(vscSettings, "utf8"));
    if (settings["typescript.tsdk"] === "node_modules/typescript/lib") {
      pass("VS Code apontando para node_modules/typescript/lib");
    } else {
      warn("VS Code não está apontando para node_modules/typescript/lib");
    }
  } catch {
    warn("Não foi possível ler .vscode/settings.json");
  }
} else {
  warn(".vscode/settings.json ausente (opcional).");
}

// 5) node_modules no HOME pode interferir
const home = process.env.HOME || process.env.USERPROFILE;
if (home) {
  const homeNm = path.join(home, "node_modules");
  if (fs.existsSync(homeNm)) {
    warn(`Existe ${homeNm}. Recomendo remover/renomear.`);
  } else {
    pass("Sem node_modules no HOME");
  }
}

if (!ok) {
  process.exit(1);
}
