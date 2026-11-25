import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  LEAD_STAGES,
  LEAD_STAGE_TO_LEGACY_LEAD_STATUS,
  LEGACY_LEAD_STATUS_TO_LEAD_STAGE,
  LEGACY_OPPORTUNITY_STAGE_TO_LEAD_STAGE,
  LEGACY_TICKET_STAGE_TO_LEAD_STAGE,
} from '@ticketz/contracts';

/**
 * A migração `unified_lead_stage` traduz os enums antigos com CASEs em SQL. Este teste garante que
 * esses CASEs são exatamente os mapeamentos legados de @ticketz/contracts (fonte da verdade).
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../');
const prismaDir = path.join(repoRoot, 'packages/storage/prisma');
const migrationSql = readFileSync(
  path.join(prismaDir, 'migrations/20270223000100_unified_lead_stage/migration.sql'),
  'utf8'
)
  // ignora o bloco de rollback comentado
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');
const schema = readFileSync(path.join(prismaDir, 'schema.prisma'), 'utf8');
const legacyTicketMigration = readFileSync(
  path.join(prismaDir, 'migrations/20270220000100_ticket_stage_and_sales_entities/migration.sql'),
  'utf8'
);

/** Extrai `WHEN 'a' THEN 'b'` do CASE que começa em `header`. */
const caseMapping = (header: string, occurrence = 0): Record<string, string> => {
  let start = -1;
  for (let i = 0; i <= occurrence; i += 1) {
    start = migrationSql.indexOf(header, start + 1);
    if (start < 0) throw new Error(`CASE não encontrado: ${header} (#${occurrence})`);
  }
  const body = migrationSql.slice(start, migrationSql.indexOf('END', start));
  return Object.fromEntries([...body.matchAll(/WHEN '([^']+)' THEN '([^']+)'/g)].map(([, from, to]) => [from, to]));
};
const caseElse = (header: string, occurrence = 0): string | undefined => {
  let start = -1;
  for (let i = 0; i <= occurrence; i += 1) start = migrationSql.indexOf(header, start + 1);
  const body = migrationSql.slice(start, migrationSql.indexOf('END', start));
  return body.match(/ELSE '([^']+)'/)?.[1];
};
const enumValues = (source: string, pattern: RegExp): string[] =>
  [...(source.match(pattern)?.[1] ?? '').matchAll(/'?([a-zA-Z_]+)'?/g)].map(([, value]) => value as string);

describe('migração unified_lead_stage', () => {
  it('cria o enum LeadStage com os ids de LEAD_STAGES, na ordem', () => {
    expect(enumValues(migrationSql, /CREATE TYPE "LeadStage" AS ENUM \(([^)]*)\)/)).toEqual([...LEAD_STAGES]);
    expect(enumValues(schema, /enum LeadStage \{([^}]*)\}/)).toEqual([...LEAD_STAGES]);
  });

  it('converte tickets.stage com LEGACY_TICKET_STAGE_TO_LEAD_STAGE e cobre todo o antigo TicketStage', () => {
    const mapping = caseMapping('ALTER COLUMN "stage" TYPE "LeadStage" USING (\n    CASE "stage"::text', 0);
    expect(mapping).toEqual(LEGACY_TICKET_STAGE_TO_LEAD_STAGE);
    const oldValues = enumValues(legacyTicketMigration, /CREATE TYPE "TicketStage" AS ENUM \(([^)]*)\)/);
    expect(oldValues.length).toBeGreaterThan(0);
    expect(Object.keys(mapping).sort()).toEqual([...oldValues].sort());
    expect(caseElse('ALTER COLUMN "stage" TYPE "LeadStage" USING (\n    CASE "stage"::text', 0)).toBe('novo');
  });

  it('converte opportunities e opportunity_activities com LEGACY_OPPORTUNITY_STAGE_TO_LEAD_STAGE', () => {
    // 1 = opportunities, 2 = opportunity_activities
    for (const occurrence of [1, 2]) {
      expect(caseMapping('TYPE "LeadStage" USING (\n    CASE "stage"::text', occurrence)).toEqual(
        LEGACY_OPPORTUNITY_STAGE_TO_LEAD_STAGE
      );
    }
    // CLOSED só vira ganho quando o lead vinculado está CONVERTED.
    expect(migrationSql).toMatch(
      /UPDATE "opportunities" AS o\s+SET "stage" = 'ganho'[\s\S]+?o\."legacy_stage" = 'CLOSED'[\s\S]+?l\."id" = o\."leadId"[\s\S]+?l\."status" = 'CONVERTED'/
    );
    expect(migrationSql).toMatch(
      /UPDATE "opportunity_activities" AS a\s+SET "stage" = 'ganho'[\s\S]+?a\."legacy_stage" = 'CLOSED'[\s\S]+?l\."status" = 'CONVERTED'/
    );
  });

  it('preenche leads.stage com LEGACY_LEAD_STATUS_TO_LEAD_STAGE e espelha o status com LEAD_STAGE_TO_LEGACY_LEAD_STATUS', () => {
    expect(caseMapping('CASE "status"::text')).toEqual(LEGACY_LEAD_STATUS_TO_LEAD_STAGE);
    const leadStatuses = enumValues(schema, /enum LeadStatus \{([^}]*)\}/);
    expect(Object.keys(LEGACY_LEAD_STATUS_TO_LEAD_STAGE).sort()).toEqual([...leadStatuses].sort());
    expect(caseMapping('CASE lt."stage"::text')).toEqual(LEAD_STAGE_TO_LEGACY_LEAD_STATUS);
  });

  it('só usa o ticket mais recente quando ele foi atualizado depois do lead e respeita as regras do funil', () => {
    expect(migrationSql).toMatch(/lt\."updatedAt" > l\."updatedAt"/);
    expect(migrationSql).toMatch(/lt\."stage" <> 'novo'/);
    expect(migrationSql).toMatch(/l\."stage" <> 'ganho'/);
    expect(migrationSql).toMatch(/\(l\."stage" <> 'perdido' OR lt\."stage" = 'reciclar'\)/);
  });

  it('remove os enums antigos e preserva os valores em legacy_stage', () => {
    expect(migrationSql).toContain('DROP TYPE "TicketStage";');
    expect(migrationSql).toContain('DROP TYPE "OpportunityStage";');
    for (const table of ['tickets', 'opportunities', 'opportunity_activities']) {
      expect(migrationSql).toContain(`ALTER TABLE "${table}" ADD COLUMN "legacy_stage" TEXT;`);
      expect(migrationSql).toContain(`UPDATE "${table}" SET "legacy_stage" = "stage"::text;`);
    }
    expect(schema).not.toMatch(/^enum (TicketStage|OpportunityStage)\b/m);
  });
});
