import { useState, type FormEvent } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { apiGet, apiPatch, apiPost } from '@/lib/api.js';

const endpoint = '/api/crm/opportunities';
const stageLabels = {
  QUALIFICATION: 'Qualificação', PREPARATION: 'Preparação',
  FOLLOW_UP: 'Acompanhamento', CLOSED: 'Encerrada',
} as const;
type Stage = keyof typeof stageLabels;
const availableStages: Record<Stage, Stage[]> = {
  QUALIFICATION: ['QUALIFICATION', 'PREPARATION', 'CLOSED'],
  PREPARATION: ['PREPARATION', 'QUALIFICATION', 'FOLLOW_UP', 'CLOSED'],
  FOLLOW_UP: ['FOLLOW_UP', 'PREPARATION', 'CLOSED'],
  CLOSED: ['CLOSED'],
};

type Opportunity = {
  id: string;
  agreementRef: string;
  employmentRef: string;
  productRef: string;
  stage: Stage;
  version: number;
  nextAction: string;
  nextActionAt: string | null;
  contact: { fullName: string };
  owner: { name: string };
};
type OpportunityDetails = Opportunity & { activities: { id: string; stage: Stage; reason: string; createdAt: string }[] };
const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const asIso = (entry: FormDataEntryValue | null) => typeof entry === 'string' && entry ? new Date(entry).toISOString() : null;
const formatInputDate = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const OpportunityDetailsPanel = ({ opportunityId }: { opportunityId: string }) => {
  const query = useQuery<OpportunityDetails>({
    queryKey: ['crm', 'opportunity', opportunityId],
    queryFn: async () => (await apiGet(`${endpoint}/${encodeURIComponent(opportunityId)}`)).data,
  });
  if (query.isLoading) return <p role="status">Carregando histórico…</p>;
  if (query.isError || !query.data) return <p role="alert">Não foi possível carregar esta oportunidade.</p>;
  return <OpportunityEditor key={query.data.version} record={query.data} />;
};

const OpportunityEditor = ({ record }: { record: OpportunityDetails }) => {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (form: FormData) => apiPatch(`${endpoint}/${encodeURIComponent(record.id)}`, {
      version: record.version, stage: form.get('stage'), nextAction: form.get('nextAction'),
      nextActionAt: asIso(form.get('nextActionAt')), reason: form.get('reason'),
    }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['crm', 'opportunities'] }),
        client.invalidateQueries({ queryKey: ['crm', 'opportunity', record.id] }),
      ]);
    },
  });
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate(new FormData(event.currentTarget));
  };
  return (
    <section className="mt-4 min-w-0 space-y-4 border-t pt-4" aria-label="Detalhes da oportunidade">
      <form onSubmit={handleSubmit} className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Label className="grid gap-2">Etapa
          <select name="stage" defaultValue={record.stage} className="h-9 w-full rounded-md border bg-background px-2">
            {availableStages[record.stage].map(stage => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}
          </select>
        </Label>
        <Label className="grid gap-2">Data da próxima ação
          <Input name="nextActionAt" type="datetime-local" defaultValue={formatInputDate(record.nextActionAt)} />
        </Label>
        <Label className="grid gap-2">Próxima ação
          <Input name="nextAction" defaultValue={record.nextAction} required maxLength={300} />
        </Label>
        <Label className="grid gap-2">Motivo da atualização
          <Input name="reason" required maxLength={200} />
        </Label>
        <div className="space-y-2 sm:col-span-2">
          {mutation.isError && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
          <Button type="submit" disabled={mutation.isPending}>Salvar atualização</Button>
        </div>
      </form>
      <h3 className="font-medium">Histórico</h3>
      <ol className="space-y-2 text-sm">
        {record.activities.map(activity => (
          <li key={activity.id} className="break-words">
            <span className="text-muted-foreground">{dateFormat.format(new Date(activity.createdAt))}</span>
            {' · '}{stageLabels[activity.stage]} · {activity.reason}
          </li>
        ))}
      </ol>
    </section>
  );
};

const CreateOpportunity = ({ contactId, leadId }: { contactId: string; leadId: string | null }) => {
  const client = useQueryClient();
  const [intentKey, setIntentKey] = useState(() => crypto.randomUUID());
  const mutation = useMutation({
    mutationFn: (form: HTMLFormElement) => {
      const fields = new FormData(form);
      return apiPost(endpoint, {
        contactId, leadId: leadId || undefined, agreementRef: fields.get('agreementRef'),
        employmentRef: fields.get('employmentRef'), productRef: fields.get('productRef'),
        nextAction: fields.get('nextAction'), nextActionAt: asIso(fields.get('nextActionAt')),
      }, { headers: { 'Idempotency-Key': intentKey } });
    },
    onSuccess: (_data, form) => {
      form.reset();
      setIntentKey(crypto.randomUUID());
      return client.invalidateQueries({ queryKey: ['crm', 'opportunities'] });
    },
  });
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate(event.currentTarget);
  };
  return (
    <section className="space-y-3 rounded-lg border p-4" aria-labelledby="new-opportunity">
      <h2 id="new-opportunity" className="font-semibold">Nova oportunidade</h2>
      <form onSubmit={handleSubmit} className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Label className="grid gap-2">Convênio<Input name="agreementRef" required maxLength={80} /></Label>
        <Label className="grid gap-2">Referência do vínculo<Input name="employmentRef" required maxLength={80} /></Label>
        <Label className="grid gap-2">Produto<Input name="productRef" required maxLength={80} /></Label>
        <Label className="grid gap-2">Data da próxima ação<Input name="nextActionAt" type="datetime-local" /></Label>
        <Label className="grid gap-2 sm:col-span-2">Próxima ação<Input name="nextAction" required maxLength={300} /></Label>
        <div className="space-y-2 sm:col-span-2">
          {mutation.isError && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
          {mutation.isSuccess && <p role="status" className="text-sm">Oportunidade registrada.</p>}
          <Button type="submit" disabled={mutation.isPending}>Criar oportunidade</Button>
        </div>
      </form>
    </section>
  );
};

export default function OpportunitiesPage() {
  const [params] = useSearchParams();
  const contactId = params.get('contactId');
  const leadId = params.get('leadId');
  const query = useInfiniteQuery({
    queryKey: ['crm', 'opportunities', contactId],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<{ items: Opportunity[]; nextCursor: string | null }> => {
      const filter = new URLSearchParams();
      if (contactId) filter.set('contactId', contactId);
      if (pageParam) filter.set('cursor', pageParam);
      return (await apiGet(`${endpoint}?${filter}`)).data;
    },
    getNextPageParam: page => page.nextCursor,
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const records = query.data?.pages.flatMap(page => page.items) ?? [];
  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Oportunidades</h1>
        <Button variant="outline" asChild><Link to="/crm">Voltar aos leads</Link></Button>
      </header>
      {contactId
        ? <CreateOpportunity key={`${contactId}:${leadId}`} contactId={contactId} leadId={leadId} />
        : <p className="text-sm text-muted-foreground">Para criar uma oportunidade, comece pelo <Link className="underline" to="/contacts">contato</Link>.</p>}
      {query.isLoading && <p role="status">Carregando oportunidades…</p>}
      {query.isError && <p role="alert">Não foi possível carregar as oportunidades. <Button variant="link" onClick={() => query.refetch()}>Tentar novamente</Button></p>}
      {query.isSuccess && !records.length && <p>Nenhuma oportunidade cadastrada.</p>}
      <ul className="space-y-3">
        {records.map(record => (
          <li key={record.id} className="min-w-0 rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 break-words">
                <h2 className="font-semibold">{record.contact.fullName}</h2>
                <p className="text-sm text-muted-foreground">{record.agreementRef} · {record.productRef} · {record.owner.name}</p>
                <p className="mt-2 text-sm">{stageLabels[record.stage]} · {record.nextAction}</p>
              </div>
              <Button variant="outline" aria-expanded={openId === record.id} onClick={() => setOpenId(openId === record.id ? null : record.id)}>
                {openId === record.id ? 'Fechar atualização' : 'Atualizar oportunidade'}
              </Button>
            </div>
            {openId === record.id && <OpportunityDetailsPanel opportunityId={record.id} />}
          </li>
        ))}
      </ul>
      {query.hasNextPage && <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Carregar mais</Button>}
    </div>
  );
}
