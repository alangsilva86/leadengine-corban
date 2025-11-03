import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Normaliza modos legados/inválidos para 'IA_AUTO'
 */
function normalizeMode(mode: string | null | undefined): 'IA_AUTO' {
  const val = String(mode ?? '').trim().toUpperCase();

  // Lista de aliases/legados que devem virar IA_AUTO
  const LEGACY_AUTO = new Set([
    'COPILOTO',
    'COPILOT',
    'AUTO',
    'AI_AUTO',
    'IA-AUTO',
    'IA.AUTO',
    'AUTO_REPLY',
    'AUTO-REPLY',
    'ASSIST',
    'ASSISTENTE',
    'DEFAULT',
    '',
    'NULL',
    'UNSET',
  ]);

  if (val === 'IA_AUTO') return 'IA_AUTO';
  if (LEGACY_AUTO.has(val)) return 'IA_AUTO';

  // Qualquer valor desconhecido vira IA_AUTO por padrão
  return 'IA_AUTO';
}

async function updateAiMode() {
  try {
    console.log('🔍 Buscando tenant demo-tenant...');

    // Buscar tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: 'demo-tenant' },
      select: { id: true, slug: true },
    });

    if (!tenant) {
      console.error('❌ Tenant demo-tenant não encontrado!');
      process.exit(1);
    }

    console.log('✅ Tenant encontrado:', tenant.id);

    // Verificar se já existe AiConfig para este tenant (escopo global)
    const existingConfig = await prisma.aiConfig.findFirst({
      where: {
        tenantId: tenant.id,
        queueId: null, // Configuração global do tenant
      },
      select: {
        id: true,
        defaultMode: true,
        enabled: true,
        model: true,
        temperature: true,
        maxTokens: true,
        streamingEnabled: true,
      },
    });

    if (existingConfig) {
      console.log('📝 AiConfig existente encontrado:', existingConfig.id);
      console.log('   Modo atual:', existingConfig.defaultMode);

      const normalized = normalizeMode(existingConfig.defaultMode ?? null);

      // Atualização idempotente: somente altera se necessário
      if (
        existingConfig.defaultMode !== normalized ||
        existingConfig.enabled !== true
      ) {
        const updated = await prisma.aiConfig.update({
          where: { id: existingConfig.id },
          data: {
            defaultMode: normalized, // garante IA_AUTO
            enabled: true,           // habilita IA
          },
        });

        console.log('✅ AiConfig atualizado com sucesso!');
        console.log('   Novo modo:', updated.defaultMode);
        console.log('   Enabled:', updated.enabled);
      } else {
        console.log('✅ Nenhuma mudança necessária. Modo já normalizado e habilitado.');
      }

      // Migração defensiva (opcional): normaliza modos legados em outros escopos do mesmo tenant
      const migrated = await prisma.aiConfig.updateMany({
        where: {
          tenantId: tenant.id,
          defaultMode: { in: ['COPILOTO', 'AUTO', 'AI_AUTO', 'IA-AUTO', 'IA.AUTO', 'AUTO_REPLY', 'AUTO-REPLY', 'ASSIST', 'ASSISTENTE', 'DEFAULT', 'NULL', ''] },
        },
        data: { defaultMode: 'IA_AUTO' },
      });
      if (migrated.count > 0) {
        console.log(`🔧 Modos legados normalizados em ${migrated.count} registro(s) adicionais do tenant.`);
      }
    } else {
      console.log('📝 Criando novo AiConfig...');

      // Criar nova configuração
      const newConfig = await prisma.aiConfig.create({
        data: {
          tenantId: tenant.id,
          queueId: null,
          enabled: true,
          defaultMode: 'IA_AUTO',
          model: 'gpt-4o-mini-2024-08-06',
          temperature: 0.7,
          maxTokens: 1000,
          streamingEnabled: true,
        },
        select: { id: true, defaultMode: true, enabled: true },
      });

      console.log('✅ AiConfig criado com sucesso!');
      console.log('   ID:', newConfig.id);
      console.log('   Modo:', newConfig.defaultMode);
      console.log('   Enabled:', newConfig.enabled);
    }

    // Verificar resultado final
    const finalConfig = await prisma.aiConfig.findFirst({
      where: {
        tenantId: tenant.id,
        queueId: null,
      },
      select: { defaultMode: true, enabled: true, model: true },
    });

    console.log('\n🎉 CONFIGURAÇÃO FINAL:');
    console.log('   Tenant:', tenant.slug);
    console.log('   Modo IA:', finalConfig?.defaultMode);
    console.log('   Habilitado:', finalConfig?.enabled);
    console.log('   Modelo:', finalConfig?.model);

  } catch (error) {
    console.error('❌ Erro ao atualizar configuração:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateAiMode();
