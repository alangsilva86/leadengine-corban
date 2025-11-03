import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateAiMode() {
  try {
    console.log('🔍 Buscando tenant demo-tenant...');
    
    // Buscar tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: 'demo-tenant' },
    });

    if (!tenant) {
      console.error('❌ Tenant demo-tenant não encontrado!');
      process.exit(1);
    }

    console.log('✅ Tenant encontrado:', tenant.id);

    // Verificar se já existe AiConfig para este tenant
    const existingConfig = await prisma.aiConfig.findFirst({
      where: {
        tenantId: tenant.id,
        queueId: null, // Configuração global do tenant
      },
    });

    if (existingConfig) {
      console.log('📝 AiConfig existente encontrado:', existingConfig.id);
      console.log('   Modo atual:', existingConfig.defaultMode);

      if (existingConfig.defaultMode === 'IA_AUTO') {
        console.log('✅ Modo já está configurado como IA_AUTO!');
      } else {
        // Atualizar configuração existente
        const updated = await prisma.aiConfig.update({
          where: { id: existingConfig.id },
          data: {
            defaultMode: 'IA_AUTO',
            enabled: true,
          },
        });

        console.log('✅ AiConfig atualizado com sucesso!');
        console.log('   Novo modo:', updated.defaultMode);
        console.log('   Enabled:', updated.enabled);
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
