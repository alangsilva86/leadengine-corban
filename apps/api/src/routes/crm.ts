import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';

const crmRouter: Router = Router();

const parseFilters = (raw: unknown): Record<string, unknown> => {
  if (typeof raw !== 'string') {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

crmRouter.get(
  '/metrics',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const filters = parseFilters(req.query.filters);

    const summary = [
      {
        id: 'activeLeads',
        label: 'Leads ativos',
        unit: 'count',
        value: 128,
        delta: 6,
        deltaUnit: 'count',
        trend: 'up',
      },
      {
        id: 'newLeads',
        label: 'Novos (7d)',
        unit: 'count',
        value: 42,
        delta: 8,
        deltaUnit: 'count',
        trend: 'up',
      },
      {
        id: 'slaCompliance',
        label: 'Dentro do SLA',
        unit: 'percentage',
        value: 86,
        delta: -4,
        deltaUnit: 'percentage',
        trend: 'down',
      },
      {
        id: 'avgResponseTime',
        label: '1ª resposta média (min)',
        unit: 'duration',
        value: 68,
        delta: -12,
        deltaUnit: 'duration',
        trend: 'up',
      },
      {
        id: 'stalledLeads',
        label: 'Sem atividade (7d)',
        unit: 'count',
        value: 17,
        delta: 2,
        deltaUnit: 'count',
        trend: 'down',
      },
      {
        id: 'conversionRate',
        label: 'Taxa de conversão',
        unit: 'percentage',
        value: 28,
        delta: 3,
        deltaUnit: 'percentage',
        trend: 'up',
      },
    ];

    res.json({
      success: true,
      data: {
        summary,
        retrievedAt: new Date().toISOString(),
        source: 'fallback',
        filters,
      },
    });
  })
);

crmRouter.get(
  '/aging',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const filters = parseFilters(req.query.filters);

    const stages = [
      { id: 'qualification', name: 'Qualificação' },
      { id: 'proposal', name: 'Proposta' },
      { id: 'negotiation', name: 'Negociação' },
      { id: 'closed-won', name: 'Ganho' },
      { id: 'closed-lost', name: 'Perdido' },
    ];

    const bucketDefinitions = [
      { id: '0-1', label: '0-1 dia' },
      { id: '2-3', label: '2-3 dias' },
      { id: '4-7', label: '4-7 dias' },
      { id: '8-14', label: '8-14 dias' },
      { id: '15+', label: '15+ dias' },
    ];

    const buckets = stages.flatMap((stage, stageIndex) =>
      bucketDefinitions.map((bucket, bucketIndex) => ({
        stageId: stage.id,
        stageName: stage.name,
        bucketId: bucket.id,
        bucketLabel: bucket.label,
        leadCount: Math.max(0, 6 - stageIndex - bucketIndex),
        potentialValue: 5000 + stageIndex * 1200 + bucketIndex * 800,
        sampleLeadId: `lead-${stage.id}-${bucket.id}`,
        sampleLeadName: `Lead ${stageIndex + 1}-${bucketIndex + 1}`,
      }))
    );

    res.json({
      success: true,
      data: {
        buckets,
        generatedAt: new Date().toISOString(),
        filters,
      },
    });
  })
);

crmRouter.get(
  '/timeline',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const filters = parseFilters(req.query.filters);
    const types = typeof req.query.types === 'string' ? req.query.types.split(',') : undefined;

    const items = [
      {
        id: 'evt-1',
        type: 'note',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        author: 'Você',
        title: 'Contato registrado',
        description: 'Lead adicionado manualmente ao CRM.',
      },
      {
        id: 'evt-2',
        type: 'call',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        author: 'Você',
        title: 'Chamada de qualificação',
        description: 'Cliente interessado no plano Plus. Retorno agendado.',
      },
      {
        id: 'evt-3',
        type: 'status_change',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 90).toISOString(),
        author: 'Equipe',
        title: 'Status atualizado',
        description: 'Lead movido para negociação.',
      },
      {
        id: 'evt-4',
        type: 'message',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
        author: 'WhatsApp',
        title: 'Mensagem recebida',
        description: 'Cliente solicitou detalhes adicionais sobre integração.',
      },
    ].filter((item) => (types && types.length > 0 ? types.includes(item.type) : true));

    res.json({ success: true, data: { items, filters } });
  })
);

crmRouter.get(
  '/tasks',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const filters = parseFilters(req.query.filters);
    const range = {
      from: req.query.from ? new Date(req.query.from as string) : new Date(),
      to: req.query.to ? new Date(req.query.to as string) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    const items = Array.from({ length: 6 }).map((_, index) => {
      const dueDate = new Date(range.from.getTime() + index * 24 * 60 * 60 * 1000);
      return {
        id: `task-${index + 1}`,
        title: index % 2 === 0 ? 'Agendar call de alinhamento' : 'Enviar follow-up',
        dueDate: dueDate.toISOString(),
        status: index === 0 ? 'overdue' : index % 3 === 0 ? 'completed' : 'pending',
        ownerId: 'owner:me',
        ownerName: 'Você',
        leadId: `lead-${index + 1}`,
        leadName: `Lead exemplo ${index + 1}`,
      };
    });

    res.json({ success: true, data: { items, filters, range } });
  })
);

export { crmRouter };
