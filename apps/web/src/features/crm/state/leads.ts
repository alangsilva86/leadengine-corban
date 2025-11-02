export type LeadStatus = 'new' | 'in_progress' | 'engaged' | 'won' | 'lost';

export interface LeadSummary {
  id: string;
  name: string;
  stage: string;
  ownerId: string | null;
  ownerName: string | null;
  lastActivityAt: string | null;
  source: string | null;
  channel: string | null;
  potentialValue?: number | null;
  status: LeadStatus;
}

export interface LeadDetail extends LeadSummary {
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  score?: number | null;
  health?: 'healthy' | 'warning' | 'critical';
  notes?: string | null;
  customFields?: Record<string, unknown> | null;
}

export interface LeadTimelineEvent {
  id: string;
  type: 'note' | 'call' | 'meeting' | 'task' | 'status_change' | 'message';
  timestamp: string;
  author?: string | null;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface LeadTask {
  id: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue';
  ownerId: string | null;
  ownerName: string | null;
  leadId?: string | null;
  leadName?: string | null;
}

export interface LeadAgingBucket {
  stageId: string;
  stageName: string;
  bucketId: string;
  bucketLabel: string;
  leadCount: number;
  potentialValue?: number | null;
  sampleLeadId?: string | null;
  sampleLeadName?: string | null;
}

export interface LeadAgingSummary {
  buckets: LeadAgingBucket[];
  generatedAt: string;
}
