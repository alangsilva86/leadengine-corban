export interface CampaignMetricsDTO {
  total: number;
  allocated: number;
  contacted: number;
  won: number;
  lost: number;
  averageResponseSeconds: number;
  budget: number | null;
  cplTarget: number | null;
  cpl: number | null;
}

export interface CampaignDTO {
  id: string;
  tenantId: string | null;
  agreementId: string | null;
  agreementName?: string | null;
  name: string;
  status: string;
  metadata: Record<string, unknown>;
  instanceId: string | null;
  instanceName: string | null;
  whatsappInstanceId: string | null;
  createdAt: Date;
  updatedAt: Date;
  metrics: CampaignMetricsDTO;
  productType?: string | null;
  marginType?: string | null;
  strategy?: string | null;
  tags: string[];
}

type WarningCode = 'CAMPAIGN_METRICS_UNAVAILABLE';

export interface CampaignWarning {
  code: WarningCode;
}
