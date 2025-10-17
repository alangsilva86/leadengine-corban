export type InboxListPosition = 'left' | 'right';

export interface UserPreferencesRecord {
  inboxListPosition: InboxListPosition;
  inboxListWidth: number;
  createdAt: string;
  updatedAt: string;
}

export const MIN_INBOX_LIST_WIDTH = 320;
export const MAX_INBOX_LIST_WIDTH = 560;
export const DEFAULT_INBOX_LIST_WIDTH = 384;
export const DEFAULT_INBOX_LIST_POSITION: InboxListPosition = 'left';

const clampWidth = (width: number): number => {
  if (!Number.isFinite(width)) {
    return DEFAULT_INBOX_LIST_WIDTH;
  }
  if (width < MIN_INBOX_LIST_WIDTH) {
    return MIN_INBOX_LIST_WIDTH;
  }
  if (width > MAX_INBOX_LIST_WIDTH) {
    return MAX_INBOX_LIST_WIDTH;
  }
  return Math.round(width);
};

const createDefaultPreferences = (): UserPreferencesRecord => {
  const now = new Date().toISOString();
  return {
    inboxListPosition: DEFAULT_INBOX_LIST_POSITION,
    inboxListWidth: DEFAULT_INBOX_LIST_WIDTH,
    createdAt: now,
    updatedAt: now,
  };
};

const userPreferencesStore = new Map<string, UserPreferencesRecord>();

export const getUserPreferences = (userId: string): UserPreferencesRecord => {
  const existing = userPreferencesStore.get(userId);
  if (existing) {
    return { ...existing };
  }

  const defaults = createDefaultPreferences();
  userPreferencesStore.set(userId, defaults);
  return { ...defaults };
};

export const updateUserPreferences = (
  userId: string,
  patch: Partial<Pick<UserPreferencesRecord, 'inboxListPosition' | 'inboxListWidth'>>
): UserPreferencesRecord => {
  const current = getUserPreferences(userId);
  const nextPosition = patch.inboxListPosition === 'right' ? 'right' : current.inboxListPosition;
  const nextWidth =
    typeof patch.inboxListWidth === 'number'
      ? clampWidth(patch.inboxListWidth)
      : current.inboxListWidth;

  const updated: UserPreferencesRecord = {
    inboxListPosition: nextPosition,
    inboxListWidth: nextWidth,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };

  userPreferencesStore.set(userId, updated);
  return { ...updated };
};

