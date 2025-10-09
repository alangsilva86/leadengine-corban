import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  mkdir,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { explore } = require('source-map-explorer');
const { generateHtml } = require('source-map-explorer/lib/html');
const analyzeCss = require('analyze-css');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = resolve(__dirname, '../dist');
const assetsDir = resolve(distDir, 'assets');
const reportsDir = resolve(distDir, 'reports');

const budgetKb = Number(process.env.CSS_BUNDLE_BUDGET_KB ?? '200');
const budgetBytes = budgetKb * 1024;

function formatKb(bytes) {
  return Number((bytes / 1024).toFixed(2));
}

async function getCssAssets() {
  try {
    const entries = await readdir(assetsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
      .map((entry) => resolve(assetsDir, entry.name));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function isNoSourceMapError(error) {
  if (!error) return false;
  if (error.code === 'NoSourceMap') return true;
  const issues = Array.isArray(error.errors) ? error.errors : [];
  return issues.some((issue) => issue?.code === 'NoSourceMap');
}

function limitOffenders(offenders = {}, limit = 5) {
  return Object.fromEntries(
    Object.entries(offenders).map(([metric, items]) => [metric, items.slice(0, limit)]),
  );
}

async function analyzeWithSourceMapExplorer(cssFiles) {
  const result = await explore(cssFiles, {
    gzip: true,
    onlyMapped: false,
    output: undefined,
  });

  const { bundles, errors = [] } = result;

  if (!bundles || bundles.length === 0) {
    throw new Error('Nenhum bundle CSS pôde ser analisado.');
  }

  const warnings = errors
    .filter((issue) => issue?.message)
    .map((issue) => `${issue.bundleName}: ${issue.message}`);

  const bundleSummaries = await Promise.all(
    bundles.map(async (bundle) => {
      const relativePath = relative(distDir, bundle.bundleName);
      const rawCss = await readFile(bundle.bundleName, 'utf8');
      const rawBytes = Buffer.byteLength(rawCss);
      const gzipBytes = bundle.totalBytes;
      const sources = Object.entries(bundle.files)
        .map(([source, data]) => ({
          source,
          size: data.size,
          sizeKb: formatKb(data.size),
        }))
        .sort((a, b) => b.size - a.size)
        .slice(0, 10);

      return {
        file: relativePath,
        gzipBytes,
        gzipKilobytes: formatKb(gzipBytes),
        rawBytes,
        rawKilobytes: formatKb(rawBytes),
        mappedBytes: bundle.mappedBytes,
        unmappedBytes: bundle.unmappedBytes,
        sources,
      };
    }),
  );

  const totalGzipBytes = bundleSummaries.reduce((acc, item) => acc + item.gzipBytes, 0);
  const totalRawBytes = bundleSummaries.reduce((acc, item) => acc + item.rawBytes, 0);

  return {
    tool: 'source-map-explorer',
    warnings,
    bundles: bundleSummaries,
    totalGzipBytes,
    totalRawBytes,
    html: generateHtml(bundles, { gzip: true }),
  };
}

function renderAnalyzeCssHtml({ bundles, totalGzipBytes, totalRawBytes, generatedAt }) {
  const rows = bundles
    .map((bundle) => {
      const metrics = bundle.metrics || {};
      return `
        <tr>
          <td><code>${bundle.file}</code></td>
          <td>${bundle.gzipKilobytes} kB</td>
          <td>${bundle.rawKilobytes} kB</td>
          <td>${metrics.rules ?? '–'}</td>
          <td>${metrics.selectors ?? '–'}</td>
          <td>${metrics.duplicatedSelectors ?? '–'}</td>
          <td>${metrics.duplicatedProperties ?? '–'}</td>
          <td>${metrics.importants ?? '–'}</td>
        </tr>
      `;
    })
    .join('\n');

  const offendersBlocks = bundles
    .map((bundle) => {
      const offenderLines = Object.entries(bundle.offenders)
        .map(([metric, items]) => {
          const formatted = items.map((item) => `<li>${item}</li>`).join('');
          return `<details><summary>${metric}</summary><ul>${formatted}</ul></details>`;
        })
        .join('');

      if (!offenderLines) {
        return '';
      }

      return `
        <section>
          <h3>Principais ocorrências em <code>${bundle.file}</code></h3>
          ${offenderLines}
        </section>
      `;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Relatório CSS (analyze-css)</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 2rem; background: #0f172a; color: #e2e8f0; }
      h1, h2, h3 { color: #38bdf8; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; background: #1e293b; }
      th, td { border: 1px solid #334155; padding: 0.5rem 0.75rem; text-align: left; }
      th { background: #0f172a; }
      code { color: #facc15; }
      details { margin: 0.5rem 0; }
      summary { cursor: pointer; }
    </style>
  </head>
  <body>
    <main>
      <h1>Relatório CSS (analyze-css)</h1>
      <p>Gerado em ${generatedAt}. Total gzip: ${formatKb(totalGzipBytes)} kB • Tamanho bruto: ${formatKb(totalRawBytes)} kB • Orçamento: ${budgetKb} kB.</p>
      <table>
        <thead>
          <tr>
            <th>Arquivo</th>
            <th>Gzip</th>
            <th>Bruto</th>
            <th>Regras</th>
            <th>Seletores</th>
            <th>Duplicados</th>
            <th>Propriedades duplicadas</th>
            <th>!important</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      ${offendersBlocks}
    </main>
  </body>
</html>`;
}

async function analyzeWithAnalyzeCss(cssFiles, generatedAt) {
  const bundles = [];
  let totalGzipBytes = 0;
  let totalRawBytes = 0;

  for (const filePath of cssFiles) {
    const cssContent = await readFile(filePath, 'utf8');
    const rawBytes = Buffer.byteLength(cssContent);
    const gzipBytes = gzipSync(cssContent).length;
    const analysis = await analyzeCss(cssContent, {});

    const bundleSummary = {
      file: relative(distDir, filePath),
      gzipBytes,
      gzipKilobytes: formatKb(gzipBytes),
      rawBytes,
      rawKilobytes: formatKb(rawBytes),
      metrics: analysis.metrics ?? {},
      offenders: limitOffenders(analysis.offenders ?? {}),
    };

    bundles.push(bundleSummary);
    totalGzipBytes += gzipBytes;
    totalRawBytes += rawBytes;
  }

  const html = renderAnalyzeCssHtml({ bundles, totalGzipBytes, totalRawBytes, generatedAt });

  return {
    tool: 'analyze-css',
    warnings: [],
    bundles,
    totalGzipBytes,
    totalRawBytes,
    html,
  };
}

async function main() {
  const cssFiles = await getCssAssets();

  if (cssFiles.length === 0) {
    console.error('Nenhum bundle CSS encontrado em', assetsDir);
    process.exitCode = 1;
    return;
  }

  await mkdir(reportsDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  let analysis;

  try {
    analysis = await analyzeWithSourceMapExplorer(cssFiles);
  } catch (error) {
    if (isNoSourceMapError(error)) {
      console.warn('Mapas de origem não encontrados. Gerando relatório com analyze-css.');
      analysis = await analyzeWithAnalyzeCss(cssFiles, generatedAt);
    } else {
      console.error('Falha ao analisar bundles CSS:', error.message ?? error);
      process.exitCode = 1;
      return;
    }
  }

  if (!analysis) {
    console.error('Não foi possível gerar o relatório CSS.');
    process.exitCode = 1;
    return;
  }

  analysis.generatedAt = generatedAt;

  const htmlReportPath = resolve(reportsDir, 'css-report.html');
  const jsonReportPath = resolve(reportsDir, 'css-report.json');

  await writeFile(htmlReportPath, analysis.html, 'utf8');

  const jsonReport = {
    generatedAt,
    tool: analysis.tool,
    budget: {
      kilobytes: budgetKb,
      bytes: budgetBytes,
    },
    totals: {
      gzipBytes: analysis.totalGzipBytes,
      gzipKilobytes: formatKb(analysis.totalGzipBytes),
      rawBytes: analysis.totalRawBytes,
      rawKilobytes: formatKb(analysis.totalRawBytes),
    },
    warnings: analysis.warnings,
    bundles: analysis.bundles,
  };

  await writeFile(jsonReportPath, JSON.stringify(jsonReport, null, 2), 'utf8');

  console.log(`Relatório CSS (${analysis.tool}) gerado:`);
  for (const summary of analysis.bundles) {
    console.log(`  • ${summary.file}: ${summary.gzipKilobytes} kB gzip`);
  }
  console.log(`Total gzip: ${formatKb(analysis.totalGzipBytes)} kB (orçamento: ${budgetKb} kB)`);
  console.log(`Arquivos: ${htmlReportPath} e ${jsonReportPath}`);

  if (analysis.totalGzipBytes > budgetBytes) {
    console.error(
      `Orçamento excedido: ${formatKb(analysis.totalGzipBytes)} kB > ${budgetKb} kB. Revise o CSS antes de prosseguir.`,
    );
    process.exitCode = 1;
  }
}

await main();
