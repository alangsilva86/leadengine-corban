import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
type TenantRecord = Awaited<ReturnType<typeof prisma.tenant.upsert>>;
type UserRecord = Awaited<ReturnType<typeof prisma.user.upsert>>;

type TenantSeedConfig = {
  id: string;
  name: string;
  slug: string;
  adminEmail: string;
  adminPassword?: string;
  agentEmail?: string;
  agentPassword?: string;
};

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  const tenantSeeds: TenantSeedConfig[] = [
    {
      id: 'demo-tenant',
      name: 'Demo Tenant',
      slug: 'demo-tenant',
      adminEmail: 'admin@ticketz.com',
      agentEmail: 'agente@ticketz.com',
    },
    {
      id: 'acme-tenant',
      name: 'Acme Finance',
      slug: 'acme-tenant',
      adminEmail: 'admin@acme.test',
      agentEmail: 'agent@acme.test',
    },
    {
      id: 'acessus-tenant',
      name: 'Acessus',
      slug: 'acessus',
      adminEmail: 'kellen.chiarato@somosacessus.com',
      adminPassword: 'Acessus01',
    },
  ];

  const seededTenants: TenantRecord[] = [];
  let demoAgentUser: UserRecord | null = null;
  let demoQueueId: string | null = null;

  for (const seed of tenantSeeds) {
    const tenant = await prisma.tenant.upsert({
      where: { slug: seed.slug },
      update: {},
      create: {
        id: seed.id,
        name: seed.name,
        slug: seed.slug,
        isActive: true,
        settings: {
          timezone: 'America/Sao_Paulo',
          language: 'pt-BR',
        },
      },
    });

    seededTenants.push(tenant);
    console.log('✅ Tenant criado:', tenant.name);

    const adminPasswordHash = bcrypt.hashSync(seed.adminPassword ?? 'admin123', 10);
    const agentPasswordHash = bcrypt.hashSync(seed.agentPassword ?? 'agent123', 10);

    const defaultQueue = await prisma.queue.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: 'Atendimento Geral',
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Atendimento Geral',
        description: 'Fila padrão para atendimento geral',
        color: '#3B82F6',
        isActive: true,
        orderIndex: 0,
      },
    });

    console.log('✅ Fila padrão criada:', defaultQueue.name, 'para', tenant.name);

    const adminUser = await prisma.user.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: seed.adminEmail,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        name: `${tenant.name} Admin`,
        email: seed.adminEmail,
        phone: '+5511999999999',
        role: 'ADMIN',
        isActive: true,
        passwordHash: adminPasswordHash,
        settings: {
          notifications: true,
          theme: 'light',
        },
      },
    });

    await prisma.userQueue.upsert({
      where: {
        userId_queueId: {
          userId: adminUser.id,
          queueId: defaultQueue.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        queueId: defaultQueue.id,
      },
    });

    let agentUser: UserRecord | null = null;
    if (seed.agentEmail) {
      agentUser = await prisma.user.upsert({
        where: {
          tenantId_email: {
            tenantId: tenant.id,
            email: seed.agentEmail,
          },
        },
        update: {},
        create: {
          tenantId: tenant.id,
          name: `${tenant.name} Agent`,
          email: seed.agentEmail,
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

      await prisma.userQueue.upsert({
        where: {
          userId_queueId: {
            userId: agentUser.id,
            queueId: defaultQueue.id,
          },
        },
        update: {},
        create: {
          userId: agentUser.id,
          queueId: defaultQueue.id,
        },
      });
    }

    console.log('✅ Usuários criados para:', tenant.name);
    if (seed.id === 'demo-tenant') {
      demoAgentUser = agentUser;
      demoQueueId = defaultQueue.id;
    }
  }

  const demoTenant = seededTenants.find((tenant) => tenant.id === 'demo-tenant');
  if (!demoTenant) {
    throw new Error('Demo tenant not seeded.');
  }

  if (!demoAgentUser || !demoQueueId) {
    throw new Error('Demo agent user/queue not seeded.');
  }
  const agentUser = demoAgentUser;
  const demoQueue = demoQueueId;

  // Criar tags base para contatos
  const tagDefinitions = [
    { name: 'whatsapp', color: '#22C55E', description: 'Contato que interage via WhatsApp' },
    { name: 'passthrough', color: '#6366F1', description: 'Criado automaticamente pelo modo passthrough' },
    { name: 'lead', color: '#F97316', description: 'Contato classificado como lead ativo' },
    { name: 'sms', color: '#3B82F6', description: 'Contato que prefere SMS' },
  ];

  const tagRecords = await Promise.all(
    tagDefinitions.map((definition) =>
      prisma.tag.upsert({
        where: {
          tenantId_name: {
            tenantId: demoTenant.id,
            name: definition.name,
          },
        },
        update: {
          color: definition.color,
          description: definition.description,
        },
        create: {
          tenantId: demoTenant.id,
          name: definition.name,
          color: definition.color,
          description: definition.description,
        },
      })
    )
  );

  const tagsByName = Object.fromEntries(tagRecords.map((tag) => [tag.name, tag]));

  // Criar contatos demo com relacionamentos completos
  const contact1 = await prisma.$transaction(async (tx) => {
    const baseDate = new Date();
    const contact = await tx.contact.upsert({
      where: {
        tenantId_primaryPhone: {
          tenantId: demoTenant.id,
          primaryPhone: '+5562999887766',
        },
      },
      update: {
        fullName: 'Maria Helena Souza',
        displayName: 'Maria Helena',
        primaryPhone: '+5562999887766',
        primaryEmail: 'maria.helena@email.com',
        document: '09941751919',
        status: 'ACTIVE',
        lifecycleStage: 'CUSTOMER',
        ownerId: agentUser.id,
        lastInteractionAt: baseDate,
        lastActivityAt: baseDate,
        customFields: {
          cidade: 'Goiânia',
          estado: 'GO',
        },
        metadata: {
          seed: true,
          channel: 'whatsapp',
        },
        notes: 'Cliente estratégico atendido pelo agente demo.',
      },
      create: {
        tenantId: demoTenant.id,
        fullName: 'Maria Helena Souza',
        displayName: 'Maria Helena',
        primaryPhone: '+5562999887766',
        primaryEmail: 'maria.helena@email.com',
        document: '09941751919',
        status: 'ACTIVE',
        lifecycleStage: 'LEAD',
        source: 'CAMPAIGN',
        ownerId: agentUser.id,
        isVip: true,
        lastInteractionAt: baseDate,
        lastActivityAt: baseDate,
        customFields: {
          cidade: 'Goiânia',
          estado: 'GO',
        },
        metadata: {
          seed: true,
          channel: 'whatsapp',
        },
        notes: 'Contato importado da campanha SAEC Goiânia.',
      },
    });

    await tx.contactPhone.upsert({
      where: {
        tenantId_phoneNumber: {
          tenantId: demoTenant.id,
          phoneNumber: '+5562999887766',
        },
      },
      update: {
        contactId: contact.id,
        isPrimary: true,
        label: 'Celular principal',
        type: 'MOBILE',
      },
      create: {
        tenantId: demoTenant.id,
        contactId: contact.id,
        phoneNumber: '+5562999887766',
        label: 'Celular principal',
        type: 'MOBILE',
        isPrimary: true,
      },
    });

    await tx.contactPhone.upsert({
      where: {
        tenantId_phoneNumber: {
          tenantId: demoTenant.id,
          phoneNumber: '+5562999123456',
        },
      },
      update: {
        contactId: contact.id,
        isPrimary: false,
        label: 'Telefone residencial',
        type: 'HOME',
      },
      create: {
        tenantId: demoTenant.id,
        contactId: contact.id,
        phoneNumber: '+5562999123456',
        label: 'Telefone residencial',
        type: 'HOME',
        isPrimary: false,
      },
    });

    await tx.contactEmail.upsert({
      where: {
        tenantId_email: {
          tenantId: demoTenant.id,
          email: 'maria.helena@email.com',
        },
      },
      update: {
        contactId: contact.id,
        isPrimary: true,
        label: 'E-mail corporativo',
        type: 'WORK',
      },
      create: {
        tenantId: demoTenant.id,
        contactId: contact.id,
        email: 'maria.helena@email.com',
        label: 'E-mail corporativo',
        type: 'WORK',
        isPrimary: true,
      },
    });

    await Promise.all(
      ['lead', 'whatsapp', 'passthrough'].map((tagName) =>
        tx.contactTag.upsert({
          where: {
            contactId_tagId: {
              contactId: contact.id,
              tagId: tagsByName[tagName].id,
            },
          },
          update: {
            addedAt: baseDate,
            addedById: agentUser.id,
          },
          create: {
            tenantId: demoTenant.id,
            contactId: contact.id,
            tagId: tagsByName[tagName].id,
            addedAt: baseDate,
            addedById: agentUser.id,
          },
        })
      )
    );

    await tx.interaction.create({
      data: {
        tenantId: demoTenant.id,
        contactId: contact.id,
        userId: agentUser.id,
        type: 'MESSAGE',
        direction: 'INBOUND',
        channel: 'WHATSAPP',
        subject: 'Primeiro contato via WhatsApp',
        content: 'Contato respondeu positivamente à campanha SAEC Goiânia.',
        metadata: {
          seed: true,
          campaign: 'saec-goiania',
        },
        occurredAt: new Date(baseDate.getTime() - 60 * 60 * 1000),
      },
    });

    await tx.task.create({
      data: {
        tenantId: demoTenant.id,
        contactId: contact.id,
        createdById: agentUser.id,
        assigneeId: agentUser.id,
        type: 'FOLLOW_UP',
        status: 'OPEN',
        priority: 'HIGH',
        title: 'Agendar retorno com Maria Helena',
        description: 'Confirmar documentação pendente e enviar proposta atualizada.',
        dueAt: new Date(baseDate.getTime() + 2 * 60 * 60 * 1000),
        metadata: {
          seed: true,
        },
      },
    });

    return contact;
  });

  const contact2 = await prisma.$transaction(async (tx) => {
    const baseDate = new Date();
    const contact = await tx.contact.upsert({
      where: {
        tenantId_primaryPhone: {
          tenantId: demoTenant.id,
          primaryPhone: '+5562999776655',
        },
      },
      update: {
        fullName: 'Carlos Henrique Lima',
        displayName: 'Carlos Henrique',
        primaryPhone: '+5562999776655',
        primaryEmail: 'carlos.henrique@email.com',
        document: '82477214500',
        status: 'ACTIVE',
        lifecycleStage: 'PROSPECT',
        ownerId: agentUser.id,
        lastInteractionAt: baseDate,
        lastActivityAt: baseDate,
        customFields: {
          cidade: 'Goiânia',
          estado: 'GO',
        },
        metadata: {
          seed: true,
          channel: 'sms',
        },
        notes: 'Preferência por comunicação via SMS.',
      },
      create: {
        tenantId: demoTenant.id,
        fullName: 'Carlos Henrique Lima',
        displayName: 'Carlos Henrique',
        primaryPhone: '+5562999776655',
        primaryEmail: 'carlos.henrique@email.com',
        document: '82477214500',
        status: 'ACTIVE',
        lifecycleStage: 'LEAD',
        source: 'CAMPAIGN',
        ownerId: agentUser.id,
        lastInteractionAt: baseDate,
        lastActivityAt: baseDate,
        customFields: {
          cidade: 'Goiânia',
          estado: 'GO',
        },
        metadata: {
          seed: true,
          channel: 'sms',
        },
        notes: 'Contato interessado em conhecer ofertas de consignado.',
      },
    });

    await tx.contactPhone.upsert({
      where: {
        tenantId_phoneNumber: {
          tenantId: demoTenant.id,
          phoneNumber: '+5562999776655',
        },
      },
      update: {
        contactId: contact.id,
        isPrimary: true,
        label: 'Celular principal',
        type: 'MOBILE',
      },
      create: {
        tenantId: demoTenant.id,
        contactId: contact.id,
        phoneNumber: '+5562999776655',
        label: 'Celular principal',
        type: 'MOBILE',
        isPrimary: true,
      },
    });

    await tx.contactEmail.upsert({
      where: {
        tenantId_email: {
          tenantId: demoTenant.id,
          email: 'carlos.henrique@email.com',
        },
      },
      update: {
        contactId: contact.id,
        isPrimary: true,
        label: 'E-mail pessoal',
        type: 'PERSONAL',
      },
      create: {
        tenantId: demoTenant.id,
        contactId: contact.id,
        email: 'carlos.henrique@email.com',
        label: 'E-mail pessoal',
        type: 'PERSONAL',
        isPrimary: true,
      },
    });

    await Promise.all(
      ['lead', 'sms'].map((tagName) =>
        tx.contactTag.upsert({
          where: {
            contactId_tagId: {
              contactId: contact.id,
              tagId: tagsByName[tagName].id,
            },
          },
          update: {
            addedAt: baseDate,
            addedById: agentUser.id,
          },
          create: {
            tenantId: demoTenant.id,
            contactId: contact.id,
            tagId: tagsByName[tagName].id,
            addedAt: baseDate,
            addedById: agentUser.id,
          },
        })
      )
    );

    await tx.interaction.create({
      data: {
        tenantId: demoTenant.id,
        contactId: contact.id,
        userId: agentUser.id,
        type: 'CALL',
        direction: 'OUTBOUND',
        channel: 'PHONE',
        subject: 'Ligação de apresentação',
        content: 'Agente realizou ligação para apresentar oferta personalizada.',
        metadata: {
          seed: true,
          outcome: 'sem-resposta',
        },
        occurredAt: new Date(baseDate.getTime() - 30 * 60 * 1000),
      },
    });

    await tx.task.create({
      data: {
        tenantId: demoTenant.id,
        contactId: contact.id,
        createdById: agentUser.id,
        assigneeId: agentUser.id,
        type: 'CALL',
        status: 'IN_PROGRESS',
        priority: 'NORMAL',
        title: 'Retornar ligação para Carlos Henrique',
        description: 'Reagendar contato para confirmar interesse e enviar proposta.',
        dueAt: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000),
        metadata: {
          seed: true,
        },
      },
    });

    return contact;
  });

  console.log('✅ Contatos demo criados com relacionamentos enriquecidos');

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
      productType: 'consignado',
      marginType: 'publico',
      strategy: 'retencao',
      tags: ['consignado', 'publico', 'retencao'],
      metadata: {
        note: 'Campanha demo criada pelo seed',
        classification: {
          productType: 'consignado',
          marginType: 'publico',
          strategy: 'retencao',
        },
        tags: ['consignado', 'publico', 'retencao'],
      },
    },
  });

  console.log('✅ Campanha demo criada:', demoCampaign.name);

  // Criar leads demo — funil único do lead: `stage` é o dono da etapa e `status` é espelhado
  // (LEAD_STAGE_TO_LEGACY_LEAD_STATUS em @ticketz/contracts).
  const lead1 = await prisma.lead.create({
    data: {
      tenantId: demoTenant.id,
      contactId: contact1.id,
      campaignId: demoCampaign.id,
      userId: agentUser.id,
      stage: 'qualificacao',
      status: 'QUALIFIED',
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
      stage: 'proposta',
      status: 'PROPOSAL',
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

  const brokerLead = await prisma.brokerLead.upsert({
    where: {
      tenantId_document: {
        tenantId: demoTenant.id,
        document: '09941751919',
      },
    },
    update: {
      tags: { set: ['respondido', 'whatsapp'] },
      registrations: { set: ['1839'] },
      margin: 487.5,
      netMargin: 390,
      score: 92,
    },
    create: {
      tenant: { connect: { id: demoTenant.id } },
      agreementId: demoCampaign.agreementId ?? 'saec-goiania',
      fullName: 'Maria Helena Souza',
      document: '09941751919',
      matricula: '1839',
      phone: '+5562999887766',
      registrations: ['1839'],
      tags: ['respondido', 'whatsapp'],
      margin: 487.5,
      netMargin: 390,
      score: 92,
      raw: {
        seed: true,
        source: 'demo',
      },
    },
  });

  await prisma.leadAllocation.upsert({
    where: {
      tenantId_leadId_campaignId: {
        tenantId: demoTenant.id,
        leadId: brokerLead.id,
        campaignId: demoCampaign.id,
      },
    },
    update: {
      status: 'contacted',
      notes: 'Lead de demonstração atualizado pelo seed.',
    },
    create: {
      tenant: { connect: { id: demoTenant.id } },
      lead: { connect: { id: brokerLead.id } },
      campaign: { connect: { id: demoCampaign.id } },
      status: 'allocated',
      notes: 'Lead de demonstração criado pelo seed.',
      payload: {
        seed: true,
        source: 'demo',
      },
    },
  });

  console.log('✅ Leads demo criados');

  console.log('✅ Alocação de lead demo criada');

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
        leadId: lead1.id,
        userId: agentUser.id,
        type: 'STATUS_CHANGED',
        title: 'Etapa alterada: Em contato → Qualificação',
        description: 'Margem consultada no convênio',
        metadata: { from: 'contato', to: 'qualificacao', source: 'crm', seed: true },
        occurredAt: new Date(Date.now() - 20 * 60 * 1000), // 20 min atrás
      },
      {
        tenantId: demoTenant.id,
        leadId: lead2.id,
        type: 'CREATED',
        title: 'Lead criado',
        description: 'Lead importado da campanha SAEC Goiânia',
        occurredAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 horas atrás
      },
      {
        tenantId: demoTenant.id,
        leadId: lead2.id,
        userId: agentUser.id,
        type: 'STATUS_CHANGED',
        title: 'Etapa alterada: Novo → Proposta',
        description: 'Simulação enviada ao cliente',
        metadata: { from: 'novo', to: 'proposta', source: 'crm', seed: true },
        occurredAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min atrás
      },
    ],
  });

  console.log('✅ Atividades de lead criadas');

  // Conversa aberta do lead em "proposta": o ticket espelha a etapa do lead (funil único).
  const existingSeedTicket = await prisma.ticket.findFirst({
    where: { tenantId: demoTenant.id, contactId: contact2.id, status: { in: ['OPEN', 'PENDING', 'ASSIGNED'] } },
    select: { id: true },
  });
  if (!existingSeedTicket) {
    await prisma.ticket.create({
      data: {
        tenantId: demoTenant.id,
        contactId: contact2.id,
        queueId: demoQueue,
        status: 'OPEN',
        priority: 'NORMAL',
        stage: lead2.stage,
        subject: 'Carlos Henrique — simulação de consignado',
        channel: 'WHATSAPP',
        metadata: { seed: true },
      },
    });
  }

  // Oportunidade (proposta de consignado) no mesmo vocabulário de etapas.
  const seedOpportunityKey = '7f1c2a9e-4b6d-4c8e-9a1f-3d5e7b9c1a20';
  await prisma.opportunity.upsert({
    where: { tenantId_intentKey: { tenantId: demoTenant.id, intentKey: seedOpportunityKey } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      contactId: contact2.id,
      leadId: lead2.id,
      ownerId: agentUser.id,
      intentKey: seedOpportunityKey,
      agreementRef: 'Convênio SAEC Goiânia',
      employmentRef: 'Matrícula 1920',
      productRef: 'Consignado — margem livre',
      stage: 'proposta',
      version: 2,
      nextAction: 'Confirmar aceite da simulação',
      nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      activities: {
        create: [
          { version: 1, stage: 'qualificacao', reason: 'Oportunidade registrada', actorId: agentUser.id },
          { version: 2, stage: 'proposta', reason: 'Simulação enviada', actorId: agentUser.id },
        ],
      },
    },
  });

  console.log('✅ Conversa e oportunidade demo criadas');

  console.log('🎉 Seed concluído com sucesso!');
  console.log('');
  console.log('📋 Dados criados:');
  console.log('   👤 Admin: admin@ticketz.com / admin123');
  console.log('   👤 Agente: agente@ticketz.com / agent123');
  console.log('   🏢 Tenant: demo-tenant');
  console.log('   📞 Contatos: 2');
  console.log('   🎯 Leads: 2 (Qualificação e Proposta)');
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
