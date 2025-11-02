export type CrmStageId = string;
export type CrmOwnerId = string;
export type CrmOriginId = string;
export type CrmChannelId = string;

export type CrmScoreRange = {
  min?: number | null;
  max?: number | null;
};

export type CrmDateRange = {
  from?: string | null;
  to?: string | null;
};

export type CrmFilterState = {
  search?: string;
  stages?: CrmStageId[];
  owners?: CrmOwnerId[];
  origins?: CrmOriginId[];
  channels?: CrmChannelId[];
  score?: CrmScoreRange | null;
  dateRange?: CrmDateRange | null;
  inactivityDays?: number | null;
};

export type CrmSavedViewScope = 'personal' | 'team' | 'organization';

export type CrmSavedView = {
  id: string;
  name: string;
  scope: CrmSavedViewScope;
  description?: string | null;
  filters: CrmFilterState;
  createdAt: string;
  updatedAt: string;
};

export type CrmSavedViewsState = {
  views: CrmSavedView[];
  activeViewId: string | null;
};
