const MS_PER_DAY = 1000 * 60 * 60 * 24;

const clampDate = (target, start, end) => {
  const time = target.getTime();
  if (time < start.getTime()) {
    return new Date(start.getTime());
  }
  if (time > end.getTime()) {
    return new Date(end.getTime());
  }
  return new Date(time);
};

const differenceInDays = (from, to) => {
  const utcFrom = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const utcTo = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((utcTo - utcFrom) / MS_PER_DAY);
};

const monthlyToDailyRate = (monthlyRate) => {
  const monthlyDecimal = monthlyRate / 100;
  return Math.pow(1 + monthlyDecimal, 1 / 30) - 1;
};

const calculatePresentValueUnit = (dailyRate, graceDays, months) => {
  let presentValue = 0;

  for (let installment = 0; installment < months; installment += 1) {
    const daysAfterContract = graceDays + 30 * installment;
    const discountFactor = Math.pow(1 + dailyRate, -daysAfterContract);
    presentValue += discountFactor;
  }

  return presentValue;
};

export const simulateConvenioDeal = ({
  margem,
  prazoMeses,
  dataSimulacao,
  janela,
  taxa,
}) => {
  if (!janela) {
    throw new Error('Convênio sem calendário de contratação configurado para esta data.');
  }

  if (!taxa) {
    throw new Error('Nenhuma taxa configurada para o produto/modalidade nesta data.');
  }

  const contratoDate = clampDate(dataSimulacao, janela.start, janela.end);
  const graceDays = differenceInDays(contratoDate, janela.firstDueDate);
  const dailyRate = monthlyToDailyRate(taxa.monthlyRate);
  const presentValueUnit = calculatePresentValueUnit(dailyRate, graceDays, prazoMeses);

  const bruto = margem * presentValueUnit;
  const tacPercent = taxa.tacPercent ?? 0;
  const tacFlat = taxa.tacFlat ?? 0;
  const tacValue = (tacPercent / 100) * bruto + tacFlat;
  const liquidValue = bruto - tacValue;
  const coefficient = margem / bruto;

  return {
    coefficient,
    grossAmount: bruto,
    tacValue,
    netAmount: liquidValue,
    details: {
      monthlyRate: taxa.monthlyRate,
      dailyRate,
      graceDays,
      janela: {
        start: janela.start,
        end: janela.end,
        firstDueDate: janela.firstDueDate,
      },
      modalidade: taxa.modalidade,
      produto: taxa.produto,
    },
  };
};

export const hasDateOverlap = (existingRanges, candidate) =>
  existingRanges.some((range) => {
    const startsBeforeCandidateEnds = range.start.getTime() <= candidate.end.getTime();
    const endsAfterCandidateStarts = range.end.getTime() >= candidate.start.getTime();
    return startsBeforeCandidateEnds && endsAfterCandidateStarts;
  });

export const computeWindowStatus = (window) => {
  const today = new Date();
  if (today < window.start) {
    return 'Futura';
  }
  if (today > window.end) {
    return 'Expirada';
  }
  return 'Ativa';
};

export const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const formatPercent = (value) =>
  `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

