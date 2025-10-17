export const STATUS_META = Object.freeze({
  allocated: { label: 'Aguardando contato', tone: 'neutral' },
  contacted: { label: 'Em conversa', tone: 'info' },
  won: { label: 'Venda realizada', tone: 'success' },
  lost: { label: 'Sem interesse', tone: 'error' },
});

export const DEFAULT_STATUS = 'allocated';
export const INBOX_STATUSES = Object.freeze(Object.keys(STATUS_META));
