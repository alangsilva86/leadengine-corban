import { formatCurrency as formatCurrencyHelper } from '@/lib/formatters/currency.ts';

const asRecord = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);

const toStringSafe = (value) => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
};

const generateId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const parseNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value
    .replace(/[^0-9,-.]+/g, '')
    .replace(/\.(?=.*\.)/g, '')
    .replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseInteger = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value !== 'string') {
    return null;
  }
  const parsed = Number.parseInt(value.replace(/[^0-9-]+/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const toEntity = (value, fallbackIdKeys = ['id', 'identifier', 'value'], fallbackLabelKeys = ['label', 'name', 'title']) => {
  const record = asRecord(value);
  if (!record) {
    const stringValue = toStringSafe(value);
    if (!stringValue) {
      return { id: '', label: '' };
    }
    return { id: stringValue, label: stringValue };
  }

  const idCandidates = [...fallbackIdKeys, 'slug', 'code'];
  const labelCandidates = [...fallbackLabelKeys, 'description'];

  let id = '';
  for (const key of idCandidates) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      id = candidate.trim();
      break;
    }
  }

  if (!id && typeof record.id === 'number') {
    id = String(record.id);
  }

  let label = '';
  for (const key of labelCandidates) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      label = candidate.trim();
      break;
    }
  }

  if (!label && id) {
    label = id;
  }

  return { id, label };
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const normalizeBaseType = (value) => {
  const normalized = toStringSafe(value).toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'margin' || normalized === 'margem' || normalized === 'installment') {
    return 'margin';
  }

  if (normalized === 'net' || normalized === 'liquido' || normalized === 'netamount' || normalized === 'net_value') {
    return 'net';
  }

  return normalized;
};

const normalizeCalculationParameters = (value) => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const baseType = normalizeBaseType(record.baseType ?? record.mode ?? record.base_type ?? record.tipoBase);
  const baseValue = parseNumber(record.baseValue ?? record.base_value ?? record.valorBase ?? record.value);
  const simulationDate = toStringSafe(record.simulationDate ?? record.date ?? record.data ?? '');
  const windowId = toStringSafe(record.windowId ?? record.window_id ?? record.janelaId ?? '');
  const windowLabel = toStringSafe(record.windowLabel ?? record.window_label ?? record.janela ?? '');
  const termOptions = ensureArray(record.termOptions ?? record.terms ?? record.prazos)
    .map((term) => parseInteger(term))
    .filter((value) => Number.isFinite(value));
  const taxIds = ensureArray(record.taxIds ?? record.tax_ids)
    .map((taxId) => toStringSafe(taxId))
    .filter((taxId) => taxId.length > 0);

  return {
    baseType,
    baseValue: Number.isFinite(baseValue) ? baseValue : null,
    simulationDate: simulationDate || null,
    windowId: windowId || null,
    windowLabel: windowLabel || null,
    termOptions,
    taxIds,
  };
};

const createEmptyTerm = (overrides = {}) => ({
  id: overrides.id ?? generateId('term'),
  term: overrides.term ?? '',
  installment: overrides.installment ?? '',
  netAmount: overrides.netAmount ?? '',
  totalAmount: overrides.totalAmount ?? '',
  coefficient: overrides.coefficient ?? null,
  tacValue: overrides.tacValue ?? null,
  source: overrides.source ?? null,
  calculation: overrides.calculation ?? null,
  metadata: overrides.metadata ?? null,
  selected: Boolean(overrides.selected),
});

const createEmptyOffer = (overrides = {}) => ({
  id: overrides.id ?? generateId('offer'),
  bankId: overrides.bankId ?? '',
  bankName: overrides.bankName ?? '',
  table: overrides.table ?? '',
  tableId: overrides.tableId ?? '',
  taxId: overrides.taxId ?? '',
  modality: overrides.modality ?? '',
  rank: overrides.rank ?? 1,
  source: overrides.source ?? null,
  metadata: overrides.metadata ?? null,
  terms:
    Array.isArray(overrides.terms) && overrides.terms.length > 0
      ? overrides.terms.map((term, index) =>
          createEmptyTerm({
            id: term.id ?? generateId(`term-${index + 1}`),
            term: term.term ?? '',
            installment: term.installment ?? '',
            netAmount: term.netAmount ?? '',
            totalAmount: term.totalAmount ?? '',
            coefficient: term.coefficient ?? null,
            tacValue: term.tacValue ?? null,
            source: term.source ?? null,
            calculation: term.calculation ?? null,
            metadata: term.metadata ?? null,
            selected: Boolean(term.selected),
          }),
        )
      : [createEmptyTerm()],
});

export const createDefaultSimulationForm = () => ({
  convenio: { id: '', label: '' },
  product: { id: '', label: '' },
  parameters: null,
  offers: [
    createEmptyOffer({ rank: 1 }),
    createEmptyOffer({ rank: 2 }),
    createEmptyOffer({ rank: 3 }),
  ],
});

const normalizeSelectedOffers = (snapshot) => {
  if (!snapshot) {
    return new Set();
  }

  if (Array.isArray(snapshot.selectedOffers)) {
    return new Set(
      snapshot.selectedOffers
        .map((entry) => {
          const record = asRecord(entry);
          if (!record) {
            return null;
          }
          const offerId = toStringSafe(record.offerId ?? record.offer_id ?? record.id);
          const termId = toStringSafe(record.termId ?? record.term_id ?? record.term);
          return offerId && termId ? `${offerId}::${termId}` : null;
        })
        .filter(Boolean),
    );
  }

  return new Set();
};

const normalizeTerms = (offer, selectedSet) => {
  const terms = ensureArray(offer?.terms ?? offer?.options ?? offer?.prazos ?? offer?.installments);
  if (terms.length === 0) {
    return offer?.term
      ? [
          createEmptyTerm({
            term: offer.term,
            installment: offer.installment ?? offer.amount ?? '',
            netAmount: offer.netAmount ?? offer.net_amount ?? offer.net_value ?? '',
            totalAmount: offer.totalAmount ?? offer.total_amount ?? offer.grossAmount ?? '',
            selected: Boolean(offer.selected),
          }),
        ]
      : [createEmptyTerm()];
  }

  return terms.map((term, index) => {
    const record = asRecord(term);
    if (!record) {
      const stringValue = toStringSafe(term);
      return createEmptyTerm({
        id: generateId(`term-${index + 1}`),
        term: stringValue,
        selected: false,
      });
    }

    const termId = record.id ?? record.termId ?? record.term_id ?? record.term ?? index + 1;
    const normalizedId = toStringSafe(termId) || generateId(`term-${index + 1}`);
    const compositeKey = `${offer?.id ?? ''}::${normalizedId}`;
    const selected = record.selected === true || selectedSet.has(compositeKey);

    return createEmptyTerm({
      id: normalizedId,
      term: record.term ?? record.months ?? record.prazo ?? record.id ?? '',
      installment: record.installment ?? record.valorParcela ?? record.amount ?? record.valor ?? '',
      netAmount: record.netAmount ?? record.valorLiquido ?? record.net_value ?? record.net ?? '',
      totalAmount: record.totalAmount ?? record.valorBruto ?? record.total ?? '',
      coefficient: parseNumber(record.coefficient ?? record.coeficiente ?? null),
      tacValue: parseNumber(record.tacValue ?? record.tac_value ?? record.tac ?? null),
      source: toStringSafe(record.source ?? ''),
      calculation: asRecord(record.calculation) ?? null,
      metadata: asRecord(record.metadata) ?? null,
      selected,
    });
  });
};

export const normalizeSimulationSnapshot = (snapshot) => {
  const record = asRecord(snapshot);
  if (!record) {
    return null;
  }

  const selectedOffers = normalizeSelectedOffers(record);
  const offers = ensureArray(record.offers ?? record.options ?? record.banks).map((offer, index) => {
    const offerRecord = asRecord(offer);
    if (!offerRecord) {
      return createEmptyOffer({ rank: index + 1 });
    }

    const offerId = offerRecord.id ?? offerRecord.offerId ?? offerRecord.bankId ?? index + 1;
    const normalizedId = toStringSafe(offerId) || generateId(`offer-${index + 1}`);

    return createEmptyOffer({
      id: normalizedId,
      bankId: toStringSafe(offerRecord.bankId ?? offerRecord.bank_id ?? normalizedId),
      bankName:
        toStringSafe(offerRecord.bankName ?? offerRecord.bank ?? offerRecord.nome ?? offerRecord.label) ||
        `Banco ${index + 1}`,
      table: toStringSafe(offerRecord.table ?? offerRecord.tabela ?? offerRecord.sheet ?? ''),
      tableId: toStringSafe(offerRecord.tableId ?? offerRecord.table_id ?? ''),
      taxId: toStringSafe(offerRecord.taxId ?? offerRecord.tax_id ?? ''),
      modality: toStringSafe(offerRecord.modality ?? offerRecord.modalidade ?? ''),
      rank: Number.isFinite(offerRecord.rank) ? offerRecord.rank : index + 1,
      source: toStringSafe(offerRecord.source ?? ''),
      metadata: asRecord(offerRecord.metadata) ?? null,
      terms: normalizeTerms({ ...offerRecord, id: normalizedId }, selectedOffers),
    });
  });

  return {
    type: record.type ?? 'simulation',
    version: record.version ?? record.flowVersion ?? null,
    generatedAt: record.generatedAt ?? record.generated_at ?? null,
    convenio: toEntity(record.convenio ?? record.agreement ?? record.convenioId ?? record.agreementId),
    product: toEntity(record.product ?? record.productType ?? record.productId ?? record.product_id),
    parameters: normalizeCalculationParameters(record.parameters ?? record.calculation ?? null),
    offers: offers.length > 0 ? offers : createDefaultSimulationForm().offers,
  };
};

export const normalizeProposalSnapshot = (snapshot) => {
  const record = asRecord(snapshot);
  if (!record) {
    return null;
  }

  const simulation = normalizeSimulationSnapshot(record.simulationSnapshot ?? record.simulation ?? snapshot);
  const selectedOffers = normalizeSelectedOffers(record);
  const offers = simulation?.offers ?? [];

  return {
    type: record.type ?? 'proposal',
    version: record.version ?? record.flowVersion ?? null,
    generatedAt: record.generatedAt ?? record.generated_at ?? null,
    simulationId: toStringSafe(record.simulationId ?? record.simulation_id ?? ''),
    proposalId: toStringSafe(record.proposalId ?? record.id ?? ''),
    convenio: simulation?.convenio ?? { id: '', label: '' },
    product: simulation?.product ?? { id: '', label: '' },
    offers: offers.map((offer) => ({
      ...offer,
      terms: offer.terms.map((term) => ({
        ...term,
        selected: term.selected || selectedOffers.has(`${offer.id}::${term.id}`),
      })),
    })),
    message: toStringSafe(record.message ?? record.whatsappMessage ?? ''),
    pdf: asRecord(record.pdf) ?? {
      fileName: toStringSafe(record.pdfFileName ?? record.pdf_name ?? ''),
      url: toStringSafe(record.pdfUrl ?? record.pdf_url ?? ''),
      status: toStringSafe(record.pdfStatus ?? 'pending'),
    },
  };
};

export const normalizeDealSnapshot = (snapshot) => {
  const record = asRecord(snapshot);
  if (!record) {
    return null;
  }

  const proposal = normalizeProposalSnapshot(record.proposalSnapshot ?? record.proposal ?? null);
  const bankEntity = toEntity(record.bank ?? record.financialInstitution ?? record.banco ?? record.bankId ?? record.bankName);

  return {
    type: record.type ?? 'deal',
    version: record.version ?? record.flowVersion ?? null,
    generatedAt: record.generatedAt ?? record.generated_at ?? null,
    simulationId: toStringSafe(record.simulationId ?? record.simulation_id ?? proposal?.simulationId ?? ''),
    proposalId: toStringSafe(record.proposalId ?? record.proposal_id ?? proposal?.proposalId ?? ''),
    convenio: proposal?.convenio ?? toEntity(record.convenio ?? record.agreement ?? ''),
    product: proposal?.product ?? toEntity(record.product ?? record.productType ?? ''),
    bank: bankEntity,
    term: record.term ?? record.termMonths ?? record.prazo ?? null,
    installment: record.installment ?? record.valorParcela ?? record.parcela ?? null,
    netAmount: record.netAmount ?? record.valorLiquido ?? record.liquido ?? null,
    totalAmount: record.totalAmount ?? record.valorBruto ?? record.total ?? null,
    closedAt: record.closedAt ?? record.closed_at ?? null,
  };
};

export const buildSimulationSnapshot = ({ convenio, product, offers, parameters }) => {
  const generatedAt = new Date().toISOString();
  const normalizedOffers = ensureArray(offers)
    .map((offer, index) => {
      const safeOffer = offer ?? {};
      const offerId = toStringSafe(safeOffer.id) || generateId(`offer-${index + 1}`);
      const terms = ensureArray(safeOffer.terms).map((term, termIndex) => {
        const safeTerm = term ?? {};
        const termId = toStringSafe(safeTerm.id) || generateId(`term-${termIndex + 1}`);
        return {
          id: termId,
          term: parseInteger(safeTerm.term),
          installment: parseNumber(safeTerm.installment),
          netAmount: parseNumber(safeTerm.netAmount),
          totalAmount: parseNumber(safeTerm.totalAmount),
          coefficient: parseNumber(safeTerm.coefficient),
          tacValue: parseNumber(safeTerm.tacValue),
          source: toStringSafe(safeTerm.source ?? ''),
          calculation: asRecord(safeTerm.calculation) ?? null,
          metadata: asRecord(safeTerm.metadata) ?? null,
          selected: Boolean(safeTerm.selected),
        };
      });

      return {
        id: offerId,
        bankId: toStringSafe(safeOffer.bankId ?? offerId),
        bankName: toStringSafe(safeOffer.bankName ?? `Banco ${index + 1}`),
        table: toStringSafe(safeOffer.table ?? ''),
        tableId: toStringSafe(safeOffer.tableId ?? ''),
        taxId: toStringSafe(safeOffer.taxId ?? ''),
        modality: toStringSafe(safeOffer.modality ?? ''),
        rank: Number.isFinite(safeOffer.rank) ? safeOffer.rank : index + 1,
        source: toStringSafe(safeOffer.source ?? ''),
        metadata: asRecord(safeOffer.metadata) ?? null,
        terms,
      };
    })
    .filter((offer) => offer.bankName.trim().length > 0);

  const selectedOffers = normalizedOffers.flatMap((offer) =>
    offer.terms
      .filter((term) => term.selected && Number.isFinite(term.term))
      .map((term) => ({
        offerId: offer.id,
        bankName: offer.bankName,
        table: offer.table,
        taxId: offer.taxId,
        source: term.source || offer.source || null,
        term: term.term,
        installment: term.installment,
        netAmount: term.netAmount,
        coefficient: term.coefficient,
      })),
  );

  const normalizedParameters = (() => {
    const base = normalizeCalculationParameters(parameters);
    const collectedTaxIds = normalizedOffers.map((offer) => offer.taxId).filter((taxId) => taxId);
    if (!base && collectedTaxIds.length === 0) {
      return null;
    }

    const mergedTaxIds = Array.from(new Set([...(base?.taxIds ?? []), ...collectedTaxIds]));

    if (!base) {
      return {
        baseType: null,
        baseValue: null,
        simulationDate: null,
        windowId: null,
        windowLabel: null,
        termOptions: [],
        taxIds: mergedTaxIds,
      };
    }

    return {
      ...base,
      taxIds: mergedTaxIds,
    };
  })();

  return {
    type: 'simulation',
    version: '2025-01',
    generatedAt,
    convenio: toEntity(convenio),
    product: toEntity(product),
    offers: normalizedOffers,
    selectedOffers,
    parameters: normalizedParameters,
  };
};

const slugify = (value) =>
  toStringSafe(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

export const buildProposalSnapshot = ({
  simulation,
  selectedOffers,
  message,
  pdf,
}) => {
  const generatedAt = new Date().toISOString();
  const normalizedSimulation = normalizeSimulationSnapshot(simulation) ?? createDefaultSimulationForm();

  const selectedSet = new Set(selectedOffers?.map((entry) => `${entry.offerId}::${entry.termId}`));

  const offers = normalizedSimulation.offers.map((offer) => ({
    ...offer,
    terms: offer.terms.map((term) => ({
      ...term,
      selected: selectedSet.has(`${offer.id}::${term.id}`) || term.selected,
    })),
  }));

  const selectedTerms = offers.flatMap((offer) =>
    offer.terms.filter((term) => term.selected).map((term) => ({ offer, term })),
  );

  const primarySelection = selectedTerms[0] ?? null;

  const pdfFileName = pdf?.fileName
    ? pdf.fileName
    : primarySelection
      ? `proposta-${slugify(primarySelection.offer.bankName)}-${primarySelection.term.term ?? 'prazo'}.pdf`
      : 'proposta.pdf';

  return {
    type: 'proposal',
    version: '2024-11',
    generatedAt,
    simulationId: toStringSafe(simulation?.simulationId ?? simulation?.id ?? ''),
    convenio: normalizedSimulation.convenio,
    product: normalizedSimulation.product,
    offers,
    selectedOffers: selectedTerms.map(({ offer, term }) => ({
      offerId: offer.id,
      bankName: offer.bankName,
      term: term.term,
      installment: term.installment,
      netAmount: term.netAmount,
    })),
    message: toStringSafe(message),
    pdf: {
      fileName: pdfFileName,
      url: toStringSafe(pdf?.url ?? ''),
      status: toStringSafe(pdf?.status ?? 'pending'),
    },
  };
};

export const buildDealSnapshot = ({
  proposal,
  bank,
  term,
  installment,
  netAmount,
  totalAmount,
  closedAt,
}) => ({
  type: 'deal',
  version: '2024-11',
  generatedAt: new Date().toISOString(),
  simulationId: toStringSafe(proposal?.simulationId ?? proposal?.simulation_id ?? ''),
  proposalId: toStringSafe(proposal?.proposalId ?? proposal?.proposal_id ?? proposal?.id ?? ''),
  convenio: proposal?.convenio ? toEntity(proposal.convenio) : { id: '', label: '' },
  product: proposal?.product ? toEntity(proposal.product) : { id: '', label: '' },
  bank: toEntity(bank ?? ''),
  term: parseInteger(term),
  installment: parseNumber(installment),
  netAmount: parseNumber(netAmount),
  totalAmount: parseNumber(totalAmount),
  closedAt: closedAt ?? null,
});

export const formatCurrency = (value, options = {}) =>
  formatCurrencyHelper(value, { fallback: '--', ...options });

export const formatTermLabel = (value, { fallback = '--' } = {}) => {
  const term = parseInteger(value);
  if (!Number.isFinite(term)) {
    return fallback;
  }
  return `${term}x`;
};

export const summarizeSimulation = (snapshot) => {
  const normalized = normalizeSimulationSnapshot(snapshot);
  if (!normalized) {
    return null;
  }

  return {
    convenio: normalized.convenio,
    product: normalized.product,
    offers: normalized.offers.map((offer) => ({
      id: offer.id,
      bankName: offer.bankName,
      table: offer.table,
      terms: offer.terms,
    })),
  };
};

export const summarizeProposal = (snapshot) => {
  const normalized = normalizeProposalSnapshot(snapshot);
  if (!normalized) {
    return null;
  }

  const selected = normalized.offers.flatMap((offer) =>
    offer.terms
      .filter((term) => term.selected)
      .map((term) => ({
        offerId: offer.id,
        bankName: offer.bankName,
        table: offer.table,
        term,
      })),
  );

  return {
    convenio: normalized.convenio,
    product: normalized.product,
    offers: normalized.offers,
    message: normalized.message,
    pdf: normalized.pdf,
    selected,
  };
};

export const summarizeDeal = (snapshot) => {
  const normalized = normalizeDealSnapshot(snapshot);
  if (!normalized) {
    return null;
  }

  return {
    convenio: normalized.convenio,
    product: normalized.product,
    bank: normalized.bank,
    term: normalized.term,
    installment: normalized.installment,
    netAmount: normalized.netAmount,
    totalAmount: normalized.totalAmount,
    closedAt: normalized.closedAt,
  };
};

export const createProposalSelection = (offers) =>
  ensureArray(offers).flatMap((offer) =>
    ensureArray(offer.terms)
      .filter((term) => term.selected)
      .map((term) => ({ offerId: offer.id, termId: term.id })),
  );

export const ensureSelectionHasItems = (selection) =>
  Array.isArray(selection) && selection.some((entry) => entry && entry.offerId && entry.termId);

export default {
  createDefaultSimulationForm,
  normalizeSimulationSnapshot,
  normalizeProposalSnapshot,
  normalizeDealSnapshot,
  buildSimulationSnapshot,
  buildProposalSnapshot,
  buildDealSnapshot,
  summarizeSimulation,
  summarizeProposal,
  summarizeDeal,
  formatCurrency,
  formatTermLabel,
  createProposalSelection,
  ensureSelectionHasItems,
};
