import { LEAD_SOURCE_LABELS, STATUS_OPTIONS } from './constants.js';

/** Resumo ao lado do assistente: mostra o que já foi escolhido. */
const CampaignSummary = ({ numberLabel, originLabel, leadSource, productLabel, margin, strategyCard, status }) => {
  const items = [
    { label: 'Número', value: numberLabel, empty: 'Escolha um número' },
    {
      label: 'Origem',
      value: originLabel,
      empty: 'Informe a origem',
      helper: originLabel && leadSource ? LEAD_SOURCE_LABELS[leadSource] : null,
    },
    {
      label: 'Produto',
      value: productLabel,
      empty: 'Escolha o produto',
      helper: productLabel && margin ? `Margem alvo de ${`${margin}`.replace('.', ',')}%` : null,
    },
    {
      label: 'Atendimento',
      value: strategyCard?.title ?? null,
      empty: 'Escolha o atendimento',
      helper: strategyCard?.cadence ?? null,
    },
    {
      label: 'Ao criar',
      value: STATUS_OPTIONS.find((option) => option.value === status)?.label ?? null,
      empty: '—',
    },
  ];

  return (
    <div className="rounded-lg border border-border bg-surface-sunken p-4">
      <p className="text-xs font-medium text-muted-foreground">Resumo</p>
      <dl className="mt-3 space-y-3">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className={item.value ? 'text-sm font-medium text-foreground' : 'text-sm text-subtle-foreground'}>
              {item.value || item.empty}
            </dd>
            {item.helper ? <dd className="text-xs text-muted-foreground">{item.helper}</dd> : null}
          </div>
        ))}
      </dl>
    </div>
  );
};

export default CampaignSummary;
