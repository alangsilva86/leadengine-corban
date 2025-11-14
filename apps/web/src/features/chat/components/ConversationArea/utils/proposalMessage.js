import { formatCurrency, formatTermLabel } from './salesSnapshot.js';

const DEFAULT_GREETING = 'Olá! Preparámos uma proposta com as melhores condições para você:';
const DEFAULT_CLOSING = 'Posso avançar com o contrato?';

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

export const createProposalMessageFromEntries = (
  entries,
  { greeting = DEFAULT_GREETING, closing = DEFAULT_CLOSING } = {},
) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return '';
  }

  const lines = entries.map((entry, index) => {
    if (!entry) {
      return null;
    }

    const termInfo = entry.term ?? entry;
    const bankName = entry.bankName ?? entry.offer?.bankName ?? '';
    const tableName = entry.table ?? entry.offer?.table ?? '';
    const termLabel = formatTermLabel(termInfo?.term);
    const installmentLabel = formatCurrency(termInfo?.installment);
    const netLabel = formatCurrency(termInfo?.netAmount);
    const tableLabel = tableName ? ` • ${tableName}` : '';

    const bankLabel = bankName || 'Banco não informado';

    if (!isNonEmptyString(termLabel) || !isNonEmptyString(installmentLabel) || !isNonEmptyString(netLabel)) {
      return null;
    }

    return `${index + 1}) ${bankLabel}${tableLabel} • ${termLabel} de ${installmentLabel} (líquido ${netLabel})`;
  });

  const filtered = lines.filter((line) => isNonEmptyString(line));
  if (filtered.length === 0) {
    return '';
  }

  return [greeting, ...filtered, closing].join('\n');
};

export const resolveProposalMessageFromSummary = (
  summary,
  options,
) => {
  if (!summary) {
    return '';
  }

  if (isNonEmptyString(summary.message)) {
    return summary.message.trim();
  }

  return createProposalMessageFromEntries(summary.selected, options);
};

export default createProposalMessageFromEntries;
