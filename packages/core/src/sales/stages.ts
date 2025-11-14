export enum SalesStage {
  NOVO = 'novo',
  CONECTADO = 'conectado',
  QUALIFICACAO = 'qualificacao',
  PROPOSTA = 'proposta',
  DOCUMENTACAO = 'documentacao',
  DOCUMENTOS_AVERBACAO = 'documentos_averbacao',
  AGUARDANDO = 'aguardando',
  AGUARDANDO_CLIENTE = 'aguardando_cliente',
  LIQUIDACAO = 'liquidacao',
  APROVADO_LIQUIDACAO = 'aprovado_liquidacao',
  RECICLAR = 'reciclar',
  DESCONHECIDO = 'desconhecido',
}

export const DEFAULT_SALES_STAGE = SalesStage.NOVO;

const stageEntries: Array<[SalesStage, ReadonlySet<SalesStage>]> = [
  [
    SalesStage.NOVO,
    new Set([SalesStage.NOVO, SalesStage.CONECTADO, SalesStage.QUALIFICACAO, SalesStage.RECICLAR]),
  ],
  [
    SalesStage.CONECTADO,
    new Set([
      SalesStage.CONECTADO,
      SalesStage.QUALIFICACAO,
      SalesStage.PROPOSTA,
      SalesStage.AGUARDANDO,
      SalesStage.AGUARDANDO_CLIENTE,
      SalesStage.RECICLAR,
    ]),
  ],
  [
    SalesStage.QUALIFICACAO,
    new Set([
      SalesStage.QUALIFICACAO,
      SalesStage.PROPOSTA,
      SalesStage.DOCUMENTACAO,
      SalesStage.AGUARDANDO,
      SalesStage.AGUARDANDO_CLIENTE,
      SalesStage.RECICLAR,
    ]),
  ],
  [
    SalesStage.PROPOSTA,
    new Set([
      SalesStage.PROPOSTA,
      SalesStage.DOCUMENTACAO,
      SalesStage.DOCUMENTOS_AVERBACAO,
      SalesStage.AGUARDANDO,
      SalesStage.AGUARDANDO_CLIENTE,
      SalesStage.LIQUIDACAO,
      SalesStage.RECICLAR,
    ]),
  ],
  [
    SalesStage.DOCUMENTACAO,
    new Set([
      SalesStage.DOCUMENTACAO,
      SalesStage.DOCUMENTOS_AVERBACAO,
      SalesStage.AGUARDANDO,
      SalesStage.AGUARDANDO_CLIENTE,
      SalesStage.LIQUIDACAO,
      SalesStage.RECICLAR,
    ]),
  ],
  [
    SalesStage.DOCUMENTOS_AVERBACAO,
    new Set([
      SalesStage.DOCUMENTOS_AVERBACAO,
      SalesStage.AGUARDANDO,
      SalesStage.AGUARDANDO_CLIENTE,
      SalesStage.LIQUIDACAO,
      SalesStage.RECICLAR,
    ]),
  ],
  [
    SalesStage.AGUARDANDO,
    new Set([
      SalesStage.AGUARDANDO,
      SalesStage.AGUARDANDO_CLIENTE,
      SalesStage.DOCUMENTACAO,
      SalesStage.DOCUMENTOS_AVERBACAO,
      SalesStage.LIQUIDACAO,
      SalesStage.RECICLAR,
    ]),
  ],
  [
    SalesStage.AGUARDANDO_CLIENTE,
    new Set([
      SalesStage.AGUARDANDO_CLIENTE,
      SalesStage.AGUARDANDO,
      SalesStage.DOCUMENTACAO,
      SalesStage.DOCUMENTOS_AVERBACAO,
      SalesStage.LIQUIDACAO,
      SalesStage.RECICLAR,
    ]),
  ],
  [
    SalesStage.LIQUIDACAO,
    new Set([SalesStage.LIQUIDACAO, SalesStage.APROVADO_LIQUIDACAO, SalesStage.RECICLAR]),
  ],
  [
    SalesStage.APROVADO_LIQUIDACAO,
    new Set([SalesStage.APROVADO_LIQUIDACAO, SalesStage.RECICLAR]),
  ],
  [
    SalesStage.RECICLAR,
    new Set([
      SalesStage.RECICLAR,
      SalesStage.NOVO,
      SalesStage.CONECTADO,
      SalesStage.QUALIFICACAO,
    ]),
  ],
  [
    SalesStage.DESCONHECIDO,
    new Set(Object.values(SalesStage)),
  ],
];

export const SALES_STAGE_TRANSITIONS: ReadonlyMap<SalesStage, ReadonlySet<SalesStage>> = new Map(
  stageEntries.map(([stage, targets]) => [stage, new Set(targets)])
);

export const canTransition = (from: SalesStage, to: SalesStage): boolean => {
  const targets = SALES_STAGE_TRANSITIONS.get(from);
  return targets ? targets.has(to) : false;
};

export const assertTransition = (from: SalesStage, to: SalesStage): void => {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid sales stage transition from "${from}" to "${to}"`);
  }
};
