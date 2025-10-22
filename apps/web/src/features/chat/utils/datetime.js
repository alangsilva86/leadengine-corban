const FORMAT_OPTIONS = {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
};

const isValidDate = (date) => !Number.isNaN(date.getTime());

export const formatDateTime = (value) => {
  if (value === null || value === undefined) return '—';

  if (typeof value === 'string' && value.trim() === '') {
    return '—';
  }

  let date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return '—';
    }
    date = new Date(value);
  } else {
    date = new Date(value);
  }

  if (!isValidDate(date)) {
    return '—';
  }

  return date.toLocaleString('pt-BR', FORMAT_OPTIONS);
};

export default formatDateTime;
