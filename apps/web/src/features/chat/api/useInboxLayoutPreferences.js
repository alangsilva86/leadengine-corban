import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api.js';

export const MIN_INBOX_LIST_WIDTH = 320;
export const MAX_INBOX_LIST_WIDTH = 560;
export const DEFAULT_INBOX_LIST_WIDTH = 384;
export const DEFAULT_INBOX_LAYOUT_PREFERENCES = Object.freeze({
  inboxListPosition: 'left',
  inboxListWidth: DEFAULT_INBOX_LIST_WIDTH,
});

export const INBOX_LAYOUT_PREFERENCES_QUERY_KEY = ['inbox', 'layout', 'preferences'];

const sanitizePreferences = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_INBOX_LAYOUT_PREFERENCES };
  }

  const position = raw.inboxListPosition === 'right' ? 'right' : 'left';

  let width = Number(raw.inboxListWidth);
  if (!Number.isFinite(width)) {
    width = DEFAULT_INBOX_LIST_WIDTH;
  }
  width = Math.min(Math.max(width, MIN_INBOX_LIST_WIDTH), MAX_INBOX_LIST_WIDTH);

  return {
    inboxListPosition: position,
    inboxListWidth: width,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  };
};

export const useInboxLayoutPreferences = ({ enabled = true } = {}) =>
  useQuery({
    queryKey: INBOX_LAYOUT_PREFERENCES_QUERY_KEY,
    enabled,
    queryFn: async () => {
      const response = await apiGet('/api/preferences');
      return sanitizePreferences(response?.data);
    },
    placeholderData: DEFAULT_INBOX_LAYOUT_PREFERENCES,
  });

export default useInboxLayoutPreferences;
