import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { id: 'demo-tenant' },
    include: {
      aiConfig: true,
    },
  });

  console.log('Tenant:', tenant?.id);
  console.log('AiConfig:', JSON.stringify(tenant?.aiConfig, null, 2));
  
  if (tenant?.aiConfig) {
    console.log('\n🔍 Modo atual:', tenant.aiConfig.defaultMode);
    console.log('✅ Enabled:', tenant.aiConfig.enabled);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
