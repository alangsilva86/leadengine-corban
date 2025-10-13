import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Criar tenant demo
  const demoTenant = await prisma.tenant.upsert({
    where: { slug: 'demo-tenant' },
    update: {},
    create: {
      id: 'demo-tenant',
      name: 'Demo Tenant',
      slug: 'demo-tenant',
      isActive: true,
      settings: {
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
      },
    },
  });

  console.log('✅ Tenant demo criado:', demoTenant.name);

  // Criar fila padrão
  const defaultQueue = await prisma.queue.upsert({
    where: { 
      tenantId_name: {
        tenantId: demoTenant.id,
        name: 'Atendimento Geral'
      }
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: 'Atendimento Geral',
      description: 'Fila padrão para atendimento geral',
      color: '#3B82F6',
      isActive: true,
      orderIndex: 0,
    },
  });

  console.log('✅ Fila padrão criada:', defaultQueue.name);

  // Criar usuário admin
  const passwordHash = createHash('sha256').update('admin123').digest('hex');
  const adminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: demoTenant.id,
        email: 'admin@ticketz.com'
      }
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: 'Administrador',
      email: 'admin@ticketz.com',
      phone: '+5511999999999',
      role: 'ADMIN',
      isActive: true,
      passwordHash,
      settings: {
        notifications: true,
        theme: 'light',
      },
    },
  });

  console.log('✅ Usuário admin criado:', adminUser.email);

  // Associar usuário à fila
  await prisma.userQueue.upsert({
    where: {
      userId_queueId: {
        userId: adminUser.id,
        queueId: defaultQueue.id,
      }
    },
    update: {},
    create: {
      userId: adminUser.id,
      queueId: defaultQueue.id,
    },
  });

  // Criar usuário agente
  const agentPasswordHash = createHash('sha256').update('agent123').digest('hex');
  const agentUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: demoTenant.id,
        email: 'agente@ticketz.com'
      }
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: 'Agente Demo',
      email: 'agente@ticketz.com',
      phone: '+5511888888888',
      role: 'AGENT',
      isActive: true,
      passwordHash: agentPasswordHash,
      settings: {
        notifications: true,
        theme: 'light',
      },
    },
  });

  console.log('✅ Usuário agente criado:', agentUser.email);

  // Associar agente à fila
  await prisma.userQueue.upsert({
    where: {
      userId_queueId: {
        userId: agentUser.id,
        queueId: defaultQueue.id,
      }
    },
    update: {},
    create: {
      userId: agentUser.id,
      queueId: defaultQueue.id,
    },
  });

  // Criar contatos demo
  const contact1 = await prisma.contact.upsert({
    where: {
      tenantId_phone: {
        tenantId: demoTenant.id,
        phone: '+5562999887766'
      }
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: 'Maria Helena Souza',
      phone: '+5562999887766',
      email: 'maria.helena@email.com',
      document: '09941751919',
      tags: ['lead', 'whatsapp'],
      customFields: {
        cidade: 'Goiânia',
        estado: 'GO',
      },
    },
  });

  const contact2 = await prisma.contact.upsert({
    where: {
      tenantId_phone: {
        tenantId: demoTenant.id,
        phone: '+5562999776655'
      }
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: 'Carlos Henrique Lima',
      phone: '+5562999776655',
      email: 'carlos.henrique@email.com',
      document: '82477214500',
      tags: ['lead', 'sms'],
      customFields: {
        cidade: 'Goiânia',
        estado: 'GO',
      },
    },
  });

  console.log('✅ Contatos demo criados');

  // Criar instância WhatsApp demo
  const demoInstance = await prisma.whatsAppInstance.upsert({
    where: { id: 'demo-whatsapp' },
    update: {
      tenantId: demoTenant.id,
      name: 'WhatsApp Demo',
      brokerId: 'demo-whatsapp',
      status: 'connected',
      connected: true,
      phoneNumber: '+5511987654321',
      metadata: {
        note: 'Instância demo criada pelo seed',
        displayId: 'demo-whatsapp',
        slug: 'demo-whatsapp',
        history: [
          {
            action: 'seed-sync',
            by: 'seed-script',
            at: new Date().toISOString(),
            status: 'connected',
            connected: true,
            metrics: {
              messagesSent: 128,
              queued: 2,
              failed: 0,
            },
          },
        ],
        lastBrokerSnapshot: {
          status: 'connected',
          connected: true,
          phoneNumber: '+5511987654321',
          metrics: {
            messagesSent: 128,
            queued: 2,
            failed: 0,
          },
          stats: {
            totalSent: 128,
            queued: 2,
            failed: 0,
          },
          rate: {
            limit: 100,
            remaining: 95,
            resetAt: new Date().toISOString(),
          },
          rateUsage: {
            limit: 100,
            used: 5,
          },
          qr: null,
        },
      },
    },
    create: {
      id: 'demo-whatsapp',
      tenantId: demoTenant.id,
      name: 'WhatsApp Demo',
      brokerId: 'demo-whatsapp',
      status: 'connected',
      connected: true,
      phoneNumber: '+5511987654321',
      metadata: {
        note: 'Instância demo criada pelo seed',
        displayId: 'demo-whatsapp',
        slug: 'demo-whatsapp',
        history: [
          {
            action: 'seed-create',
            by: 'seed-script',
            at: new Date().toISOString(),
            status: 'connected',
            connected: true,
            metrics: {
              messagesSent: 128,
              queued: 2,
              failed: 0,
            },
          },
        ],
        lastBrokerSnapshot: {
          status: 'connected',
          connected: true,
          phoneNumber: '+5511987654321',
          metrics: {
            messagesSent: 128,
            queued: 2,
            failed: 0,
          },
          stats: {
            totalSent: 128,
            queued: 2,
            failed: 0,
          },
          rate: {
            limit: 100,
            remaining: 95,
            resetAt: new Date().toISOString(),
          },
          rateUsage: {
            limit: 100,
            used: 5,
          },
          qr: null,
        },
      },
    },
  });

  console.log('✅ Instância WhatsApp demo criada:', demoInstance.name);

  // Criar campanha demo
  const demoCampaign = await prisma.campaign.create({
    data: {
      tenantId: demoTenant.id,
      name: 'ConsigTec Goiânia • demo-whatsapp',
      agreementId: 'saec-goiania',
      agreementName: 'Convênio SAEC Goiânia',
      whatsappInstanceId: demoInstance.id,
      status: 'active',
      metadata: {
        note: 'Campanha demo criada pelo seed',
      },
    },
  });

  console.log('✅ Campanha demo criada:', demoCampaign.name);

  // Criar leads demo
  const lead1 = await prisma.lead.create({
    data: {
      tenantId: demoTenant.id,
      contactId: contact1.id,
      campaignId: demoCampaign.id,
      userId: agentUser.id,
      status: 'CONTACTED',
      source: 'WHATSAPP',
      score: {
        total: 92,
        demographic: 85,
        behavioral: 95,
        engagement: 90,
        lastCalculatedAt: new Date().toISOString(),
      },
      value: 5000.0,
      probability: 75,
      tags: ['alta-prioridade', 'respondeu'],
      customFields: {
        margin: 487.5,
        netMargin: 390,
        registrations: ['1839'],
        agreementId: 'saec-goiania',
      },
      lastContactAt: new Date(),
      nextFollowUpAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // amanhã
    },
  });

  const lead2 = await prisma.lead.create({
    data: {
      tenantId: demoTenant.id,
      contactId: contact2.id,
      campaignId: demoCampaign.id,
      status: 'NEW',
      source: 'WHATSAPP',
      score: {
        total: 88,
        demographic: 80,
        behavioral: 90,
        engagement: 85,
        lastCalculatedAt: new Date().toISOString(),
      },
      value: 4500.0,
      probability: 60,
      tags: ['novo'],
      customFields: {
        margin: 512.4,
        netMargin: 405.8,
        registrations: ['1920'],
        agreementId: 'saec-goiania',
      },
    },
  });

  console.log('✅ Leads demo criados');

  // Criar atividades para os leads
  await prisma.leadActivity.createMany({
    data: [
      {
        tenantId: demoTenant.id,
        leadId: lead1.id,
        userId: agentUser.id,
        type: 'CREATED',
        title: 'Lead criado',
        description: 'Lead importado da campanha SAEC Goiânia',
        occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 horas atrás
      },
      {
        tenantId: demoTenant.id,
        leadId: lead1.id,
        userId: agentUser.id,
        type: 'WHATSAPP_SENT',
        title: 'Mensagem enviada',
        description: 'Primeira abordagem via WhatsApp',
        occurredAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hora atrás
      },
      {
        tenantId: demoTenant.id,
        leadId: lead1.id,
        type: 'WHATSAPP_REPLIED',
        title: 'Cliente respondeu',
        description: 'Cliente demonstrou interesse',
        occurredAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min atrás
      },
      {
        tenantId: demoTenant.id,
        leadId: lead2.id,
        type: 'CREATED',
        title: 'Lead criado',
        description: 'Lead importado da campanha SAEC Goiânia',
        occurredAt: new Date(),
      },
    ],
  });

  console.log('✅ Atividades de lead criadas');

  console.log('🎉 Seed concluído com sucesso!');
  console.log('');
  console.log('📋 Dados criados:');
  console.log('   👤 Admin: admin@ticketz.com / admin123');
  console.log('   👤 Agente: agente@ticketz.com / agent123');
  console.log('   🏢 Tenant: demo-tenant');
  console.log('   📞 Contatos: 2');
  console.log('   🎯 Leads: 2');
  console.log('   📊 Campanha: 1');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
