import bcrypt from 'bcryptjs';
import { Prisma, PrismaClient } from '@prisma/client';
import { demoAgreementsSeed } from '../../../config/demo-agreements';

const prisma = new PrismaClient();
type TenantRecord = Awaited<ReturnType<typeof prisma.tenant.upsert>>;

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  const tenantSeeds = [
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
  ];

  const seededTenants: TenantRecord[] = [];
  let demoAgentUser: TenantRecord | null = null;
  const adminPasswordHash = bcrypt.hashSync('admin123', 10);
  const agentPasswordHash = bcrypt.hashSync('agent123', 10);

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

    const agentUser = await prisma.user.upsert({
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

    console.log('✅ Usuários criados para:', tenant.name);
    if (seed.id === 'demo-tenant') {
      demoAgentUser = agentUser;
    }
  }

  const demoTenant = seededTenants.find((tenant) => tenant.id === 'demo-tenant');
  if (!demoTenant) {
    throw new Error('Demo tenant not seeded.');
  }

  if (!demoAgentUser) {
    throw new Error('Demo agent user not seeded.');
  }
  const agentUser = demoAgentUser;

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

  // Criar convênios baseados em cadastros reais da aba de Configurações
  const toDecimal = (value?: string | number | null) =>
    value === null || value === undefined ? null : new Prisma.Decimal(value);

  for (const seedAgreement of demoAgreementsSeed) {
    const agreementId = seedAgreement.id ?? seedAgreement.slug;
    const publishedAt = seedAgreement.publishedAt ? new Date(seedAgreement.publishedAt) : new Date();

    const agreement = await prisma.agreement.upsert({
      where: { id: agreementId },
      update: {
        name: seedAgreement.name,
        slug: seedAgreement.slug,
        status: seedAgreement.status ?? 'published',
        type: seedAgreement.type,
        segment: seedAgreement.segment,
        description: seedAgreement.description,
        tags: seedAgreement.tags,
        products: seedAgreement.products,
        metadata: {
          ...(seedAgreement.metadata ?? {}),
          seed: true,
          source: 'seed',
        },
        archived: false,
        publishedAt,
      },
      create: {
        id: agreementId,
        tenantId: demoTenant.id,
        name: seedAgreement.name,
        slug: seedAgreement.slug,
        status: seedAgreement.status ?? 'published',
        type: seedAgreement.type,
        segment: seedAgreement.segment,
        description: seedAgreement.description,
        tags: seedAgreement.tags,
        products: seedAgreement.products,
        metadata: {
          ...(seedAgreement.metadata ?? {}),
          seed: true,
          source: 'seed',
        },
        archived: false,
        publishedAt,
      },
    });

    for (const tableSeed of seedAgreement.tables ?? []) {
      const tableId = tableSeed.id ?? `${agreement.id}-${tableSeed.name}`;
      const effectiveFrom = tableSeed.effectiveFrom ? new Date(tableSeed.effectiveFrom) : null;
      const effectiveTo = tableSeed.effectiveTo ? new Date(tableSeed.effectiveTo) : null;

      const table = await prisma.agreementTable.upsert({
        where: { id: tableId },
        update: {
          name: tableSeed.name,
          product: tableSeed.product,
          modality: tableSeed.modality,
          version: tableSeed.version,
          effectiveFrom,
          effectiveTo,
          metadata: tableSeed.metadata,
        },
        create: {
          id: tableId,
          tenantId: demoTenant.id,
          agreementId: agreement.id,
          name: tableSeed.name,
          product: tableSeed.product,
          modality: tableSeed.modality,
          version: tableSeed.version,
          effectiveFrom,
          effectiveTo,
          metadata: tableSeed.metadata,
        },
      });

      for (const rateSeed of tableSeed.rates ?? []) {
        const rateId = rateSeed.id ?? `${table.id}-${rateSeed.termMonths ?? 'na'}`;
        await prisma.agreementRate.upsert({
          where: { id: rateId },
          update: {
            product: tableSeed.product,
            modality: tableSeed.modality,
            termMonths: rateSeed.termMonths,
            coefficient: toDecimal(rateSeed.coefficient),
            monthlyRate: toDecimal(rateSeed.monthlyRate),
            annualRate: toDecimal(rateSeed.annualRate),
            tacPercentage: toDecimal(rateSeed.tacPercentage),
            metadata: rateSeed.metadata ?? { seed: true },
          },
          create: {
            id: rateId,
            tenantId: demoTenant.id,
            agreementId: agreement.id,
            tableId: table.id,
            product: tableSeed.product,
            modality: tableSeed.modality,
            termMonths: rateSeed.termMonths,
            coefficient: toDecimal(rateSeed.coefficient),
            monthlyRate: toDecimal(rateSeed.monthlyRate),
            annualRate: toDecimal(rateSeed.annualRate),
            tacPercentage: toDecimal(rateSeed.tacPercentage),
            metadata: rateSeed.metadata ?? { seed: true },
          },
        });
      }
    }
  }

  console.log(
    '✅ Convênios demo cadastrados:',
    demoAgreementsSeed.map((agreement) => agreement.name).join(', '),
  );

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
