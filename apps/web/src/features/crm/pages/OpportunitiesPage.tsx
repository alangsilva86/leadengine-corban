import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, Loader2, Users } from 'lucide-react';
import { EmptyState, ErrorState, PageHeader } from '@/components/page';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { apiGet, apiPatch, apiPost } from '@/lib/api.js';
import { getFriendlyErrorMessage } from '@/lib/errors.js';
import { useContactDetailsQuery } from '@/features/contacts/hooks/useContactsApi.js';
import { AGREEMENT_SUGGESTIONS, PRODUCT_SUGGESTIONS, formatDateTime } from '../utils/labels';
import { getLeadStageLabel, getLeadStageOptions, normalizeLeadStage } from '../utils/lead-stage';
import LeadStageBadge from '../components/lead-stage/LeadStageBadge';

const endpoint = '/api/crm/opportunities';
/** A oportunidade usa o mesmo funil do lead: id do contrato (`LeadStage`); valores antigos são normalizados na tela. */
type Stage = string;

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
const asIso = (entry: FormDataEntryValue | null) => (typeof entry === 'string' && entry ? new Date(entry).toISOString() : null);
const formatInputDate = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const SELECT_CLASS =
  'h-9 w-full rounded-md border border-input bg-surface px-2 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const Field = ({ id, label, hint, children, className }: { id: string; label: string; hint?: string; children: ReactNode; className?: string }) => (
  <div className={`grid min-w-0 gap-1.5 ${className ?? ''}`}>
    <Label htmlFor={id}>{label}</Label>
    {children}
    {hint ? (
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint}
      </p>
    ) : null}
  </div>
);

const OpportunityDetailsPanel = ({ opportunityId }: { opportunityId: string }) => {
  const query = useQuery<OpportunityDetails>({
    queryKey: ['crm', 'opportunity', opportunityId],
    queryFn: async () => (await apiGet(`${endpoint}/${encodeURIComponent(opportunityId)}`)).data,
  });
  if (query.isLoading) {
    return (
      <div className="mt-4 space-y-2 border-t border-border pt-4" role="status" aria-label="Carregando histórico">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <ErrorState size="compact" title="Não foi possível carregar esta oportunidade" error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  return <OpportunityEditor key={query.data.version} record={query.data} />;
};

const OpportunityEditor = ({ record }: { record: OpportunityDetails }) => {
  const client = useQueryClient();
  const baseId = useId();
  const mutation = useMutation({
    mutationFn: (form: FormData) =>
      apiPatch(`${endpoint}/${encodeURIComponent(record.id)}`, {
        version: record.version,
        stage: form.get('stage'),
        nextAction: form.get('nextAction'),
        nextActionAt: asIso(form.get('nextActionAt')),
        reason: form.get('reason'),
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
  const currentStage = normalizeLeadStage(record.stage, 'qualificacao');
  const stageOptions = getLeadStageOptions(currentStage);
  const stageBlockedReason = stageOptions.find((option) => option.disabled)?.reason ?? null;
  return (
    <section className="mt-4 min-w-0 space-y-4 border-t border-border pt-4" aria-label="Detalhes da oportunidade">
      <form onSubmit={handleSubmit} className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Field id={`${baseId}-stage`} label="Etapa" hint={stageBlockedReason ?? undefined}>
          <select
            id={`${baseId}-stage`}
            name="stage"
            defaultValue={currentStage}
            className={SELECT_CLASS}
            aria-describedby={stageBlockedReason ? `${baseId}-stage-hint` : undefined}
          >
            <optgroup label="Funil">
              {stageOptions
                .filter((option) => !option.exit)
                .map((option) => (
                  <option key={option.id} value={option.id} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Saídas">
              {stageOptions
                .filter((option) => option.exit)
                .map((option) => (
                  <option key={option.id} value={option.id} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))}
            </optgroup>
          </select>
        </Field>
        <Field id={`${baseId}-next-at`} label="Data da próxima ação">
          <Input id={`${baseId}-next-at`} name="nextActionAt" type="datetime-local" defaultValue={formatInputDate(record.nextActionAt)} />
        </Field>
        <Field id={`${baseId}-next`} label="Próxima ação">
          <Input id={`${baseId}-next`} name="nextAction" defaultValue={record.nextAction} required maxLength={300} />
        </Field>
        <Field id={`${baseId}-reason`} label="Motivo da atualização">
          <Input id={`${baseId}-reason`} name="reason" required maxLength={200} placeholder="Ex.: Documentos conferidos" />
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Salvar atualização
          </Button>
          {mutation.isError ? (
            <p role="alert" className="text-sm text-danger-soft-foreground">
              {getFriendlyErrorMessage(mutation.error, 'Não foi possível salvar a atualização.')}
            </p>
          ) : null}
        </div>
      </form>
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground">Histórico</h4>
        <ol className="space-y-1.5 text-sm">
          {record.activities.map((activity) => (
            <li key={activity.id} className="break-words text-foreground">
              <span className="text-muted-foreground tabular-nums">{dateFormat.format(new Date(activity.createdAt))}</span>
              {' · '}
              {getLeadStageLabel(normalizeLeadStage(activity.stage, 'qualificacao'))} · {activity.reason}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

const CreateOpportunity = ({ contactId, leadId, contactName }: { contactId: string; leadId: string | null; contactName?: string | null }) => {
  const client = useQueryClient();
  const baseId = useId();
  const [intentKey, setIntentKey] = useState(() => crypto.randomUUID());
  const mutation = useMutation({
    mutationFn: (form: HTMLFormElement) => {
      const fields = new FormData(form);
      return apiPost(
        endpoint,
        {
          contactId,
          leadId: leadId || undefined,
          agreementRef: fields.get('agreementRef'),
          employmentRef: fields.get('employmentRef'),
          productRef: fields.get('productRef'),
          nextAction: fields.get('nextAction'),
          nextActionAt: asIso(fields.get('nextActionAt')),
        },
        { headers: { 'Idempotency-Key': intentKey } }
      );
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
  const agreementList = `${baseId}-agreements`;
  const productList = `${baseId}-products`;

  return (
    <section className="space-y-4 rounded-lg border border-border bg-surface p-4" aria-labelledby="new-opportunity">
      <div className="space-y-0.5">
        <h2 id="new-opportunity" className="text-base font-semibold text-foreground">
          Nova oportunidade
        </h2>
        <p className="text-sm text-muted-foreground">
          {contactName ? `Simulação de consignado para ${contactName}.` : 'Simulação de consignado para o contato.'}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Field id={`${baseId}-agreement`} label="Convênio">
          <Input id={`${baseId}-agreement`} name="agreementRef" list={agreementList} required maxLength={80} placeholder="INSS, SIAPE…" />
          <datalist id={agreementList}>
            {AGREEMENT_SUGGESTIONS.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </Field>
        <Field id={`${baseId}-employment`} label="Referência do vínculo">
          <Input id={`${baseId}-employment`} name="employmentRef" required maxLength={80} placeholder="Matrícula ou nº do benefício" />
        </Field>
        <Field id={`${baseId}-product`} label="Produto">
          <Input id={`${baseId}-product`} name="productRef" list={productList} required maxLength={80} placeholder="Novo, refinanciamento…" />
          <datalist id={productList}>
            {PRODUCT_SUGGESTIONS.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </Field>
        <Field id={`${baseId}-next-at`} label="Data da próxima ação">
          <Input id={`${baseId}-next-at`} name="nextActionAt" type="datetime-local" />
        </Field>
        <Field id={`${baseId}-next`} label="Próxima ação" className="sm:col-span-2">
          <Input id={`${baseId}-next`} name="nextAction" required maxLength={300} placeholder="Ex.: Enviar simulação pelo WhatsApp" />
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Criar oportunidade
          </Button>
          {mutation.isError ? (
            <p role="alert" className="text-sm text-danger-soft-foreground">
              {getFriendlyErrorMessage(mutation.error, 'Não foi possível criar a oportunidade.')}
            </p>
          ) : null}
          {mutation.isSuccess ? (
            <p role="status" className="text-sm text-success-soft-foreground">
              Oportunidade registrada.
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
};

export default function OpportunitiesPage() {
  const [params] = useSearchParams();
  const contactId = params.get('contactId');
  const leadId = params.get('leadId');
  const contactQuery = useContactDetailsQuery(contactId);
  const contactName: string | null = contactQuery.data?.name ?? null;
  const query = useInfiniteQuery({
    queryKey: ['crm', 'opportunities', contactId],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<{ items: Opportunity[]; nextCursor: string | null }> => {
      const filter = new URLSearchParams();
      if (contactId) filter.set('contactId', contactId);
      if (pageParam) filter.set('cursor', pageParam);
      return (await apiGet(`${endpoint}?${filter}`)).data;
    },
    getNextPageParam: (page) => page.nextCursor,
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const records = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {contactId ? (
        <Button asChild variant="ghost" size="sm" className="-mb-2 -ml-2 w-fit text-muted-foreground">
          <Link to={`/contacts/${encodeURIComponent(contactId)}`}>
            <ArrowLeft aria-hidden="true" />
            Voltar ao contato
          </Link>
        </Button>
      ) : null}
      <PageHeader
        title="Oportunidades"
        description="Propostas de consignado: convênio, produto e a próxima ação de cada cliente."
        meta={
          contactId ? (
            <span>
              Mostrando as oportunidades de <span className="font-medium text-foreground">{contactName ?? 'um contato'}</span>
              {' · '}
              <Link to="/crm/opportunities" className="text-primary hover:underline">
                ver todas
              </Link>
            </span>
          ) : null
        }
      />

      {contactId ? <CreateOpportunity key={`${contactId}:${leadId}`} contactId={contactId} leadId={leadId} contactName={contactName} /> : null}

      {query.isLoading ? (
        <div className="space-y-3" role="status" aria-label="Carregando oportunidades">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ) : null}

      {query.isError ? (
        <div className="rounded-lg border border-border bg-surface">
          <ErrorState title="Não foi possível carregar as oportunidades" error={query.error} onRetry={() => void query.refetch()} />
        </div>
      ) : null}

      {query.isSuccess && !records.length ? (
        contactId ? (
          <p className="text-sm text-muted-foreground">Este contato ainda não tem oportunidades. Registre a primeira acima.</p>
        ) : (
          <div className="rounded-lg border border-border bg-surface">
            <EmptyState
              icon={Briefcase}
              title="Nenhuma oportunidade ainda"
              description="Abra um contato e registre a simulação de consignado para acompanhar convênio, produto e próxima ação."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link to="/contacts">
                    <Users aria-hidden="true" />
                    Ver contatos
                  </Link>
                </Button>
              }
            />
          </div>
        )
      ) : null}

      {records.length ? (
        <ul className="space-y-3" aria-label="Oportunidades">
          {records.map((record) => (
            <li key={record.id} className="min-w-0 rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1 break-words">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-foreground">{record.contact.fullName}</h3>
                    <LeadStageBadge stage={normalizeLeadStage(record.stage, 'qualificacao')} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {record.agreementRef} · {record.productRef} · Vínculo {record.employmentRef} · {record.owner.name}
                  </p>
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">Próxima ação:</span> {record.nextAction}
                    {record.nextActionAt ? <span className="text-muted-foreground"> · {formatDateTime(record.nextActionAt)}</span> : null}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  aria-expanded={openId === record.id}
                  onClick={() => setOpenId(openId === record.id ? null : record.id)}
                >
                  {openId === record.id ? 'Fechar atualização' : 'Atualizar oportunidade'}
                </Button>
              </div>
              {openId === record.id ? <OpportunityDetailsPanel opportunityId={record.id} /> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
            {query.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
