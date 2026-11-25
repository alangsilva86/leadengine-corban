#!/usr/bin/env node
/**
 * Catraca de tipos: o projeto ainda tem erros de TypeScript herdados, então `tsc` não pode bloquear o CI.
 * Este script impede que a situação PIORE: compara os erros atuais, arquivo por arquivo, com a linha de base
 * em `scripts/typecheck-baseline.json` e falha se algum arquivo ganhou erros (ou se um arquivo novo tem erros).
 *
 * Uso:
 *   node scripts/typecheck-ratchet.mjs            # verifica (CI)
 *   node scripts/typecheck-ratchet.mjs --update   # regrava a linha de base (só depois de corrigir erros)
 *   node scripts/typecheck-ratchet.mjs --no-prepare  # pula a preparação (cliente Prisma + build dos pacotes)
 *
 * A contagem depende de artefatos gerados: o cliente Prisma e o `dist` dos pacotes (project references).
 * Por isso o script os prepara antes, para dar o mesmo resultado num clone limpo, no CI e na máquina local.
 *
 * Ao corrigir erros, rode com --update e faça commit da linha de base menor: a catraca só anda para frente.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'typecheck-baseline.json');
const PROJECTS = [
  'packages/shared',
  'packages/core',
  'packages/storage',
  'packages/wa-contracts',
  'packages/contracts',
  'apps/api',
  'apps/web',
];

const update = process.argv.includes('--update');
const prepare = !process.argv.includes('--no-prepare');
const tscBin = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

const runPnpm = (args) => {
  const result = spawnSync('pnpm', args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`\nFalha ao preparar o typecheck: pnpm ${args.join(' ')}`);
    process.exit(result.status ?? 1);
  }
};

// Pacotes referenciados pela API (project references): o typecheck da API lê as declarações (.d.ts)
// emitidas por `tsc -b`. Sem elas, cada import vira TS6305 e esconde os erros reais daquele arquivo,
// e a contagem passa a depender do que estiver compilado na máquina.
const REFERENCED_PACKAGES = ['packages/contracts', 'packages/shared', 'packages/core', 'packages/storage', 'packages/wa-contracts'];

if (prepare) {
  console.log('Preparando: cliente Prisma e declarações dos pacotes referenciados…');
  runPnpm(['--filter', '@ticketz/storage', 'run', 'prisma:generate']);
  // --force: o tsup (build:libs) limpa o dist, mas o tsbuildinfo continua dizendo que as declarações
  // estão em dia; sem forçar, o tsc -b não as reemite e voltam os TS6305.
  const build = spawnSync(process.execPath, [tscBin, '-b', '--force', ...REFERENCED_PACKAGES.map((dir) => join(ROOT, dir))], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (build.status !== 0) {
    console.error('\nFalha ao gerar as declarações dos pacotes (tsc -b).');
    process.exit(build.status ?? 1);
  }
}

const ERROR_LINE = /^(.+?)\((\d+),(\d+)\): error (TS\d+):/;

const runProject = (project) => {
  const result = spawnSync(process.execPath, [tscBin, '--noEmit', '--pretty', 'false', '-p', join(ROOT, project, 'tsconfig.json')], {
    cwd: join(ROOT, project),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const counts = {};
  for (const line of `${result.stdout}\n${result.stderr}`.split('\n')) {
    // Erros sem arquivo (configuração inválida, opção desconhecida) também contam.
    if (/^error TS\d+:/.test(line.trim())) {
      const key = `${project}/<configuração>`;
      counts[key] = (counts[key] ?? 0) + 1;
      continue;
    }
    const match = ERROR_LINE.exec(line.trim());
    if (!match) continue;
    // Caminhos relativos à raiz do repositório, para a linha de base não depender da máquina.
    const file = relative(ROOT, resolve(join(ROOT, project), match[1])).split('\\').join('/');
    counts[file] = (counts[file] ?? 0) + 1;
  }
  return counts;
};

const current = {};
for (const project of PROJECTS) {
  const started = Date.now();
  const counts = runProject(project);
  // Um mesmo arquivo pode aparecer em mais de um projeto (ex.: contracts incluído pelo web): fica o maior.
  for (const [file, count] of Object.entries(counts)) {
    current[file] = Math.max(current[file] ?? 0, count);
  }
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  console.log(`• ${project}: ${total} erro(s) em ${Object.keys(counts).length} arquivo(s) (${Math.round((Date.now() - started) / 1000)}s)`);
}

const sortObject = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
const totalOf = (object) => Object.values(object).reduce((sum, value) => sum + value, 0);

if (update || !existsSync(BASELINE_PATH)) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ total: totalOf(current), files: sortObject(current) }, null, 2)}\n`);
  console.log(`\nLinha de base gravada: ${totalOf(current)} erro(s) em ${Object.keys(current).length} arquivo(s).`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).files ?? {};
const regressions = [];
const improvements = [];
for (const file of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
  const before = baseline[file] ?? 0;
  const after = current[file] ?? 0;
  if (after > before) regressions.push({ file, before, after });
  else if (after < before) improvements.push({ file, before, after });
}

console.log(`\nTotal: ${totalOf(current)} erro(s) (linha de base: ${totalOf(baseline)}).`);
if (improvements.length > 0) {
  console.log(`\n✔ ${improvements.length} arquivo(s) melhoraram — rode com --update e faça commit da linha de base:`);
  for (const { file, before, after } of improvements) console.log(`   ${file}: ${before} → ${after}`);
}
if (regressions.length > 0) {
  console.error(`\n✖ ${regressions.length} arquivo(s) ganharam erros de tipo:`);
  for (const { file, before, after } of regressions) console.error(`   ${file}: ${before} → ${after}`);
  console.error('\nCorrija os erros novos (rode `pnpm exec tsc --noEmit -p <projeto>/tsconfig.json` para ver as mensagens).');
  process.exit(1);
}
console.log('\nNenhum arquivo piorou.');
