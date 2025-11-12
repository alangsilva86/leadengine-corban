import { Badge } from '@/components/ui/badge.jsx';

const CampaignGroup = ({ agreementId, children, count, label }) => (
  <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <Badge variant="secondary">{count} campanha(s)</Badge>
      </div>
      {agreementId ? (
        <p className="text-xs text-muted-foreground">ID: {agreementId}</p>
      ) : (
        <p className="text-xs text-muted-foreground">Convênio sem identificação</p>
      )}
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

export default CampaignGroup;
