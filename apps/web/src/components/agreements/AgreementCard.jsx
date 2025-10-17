import { ArrowRight, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';

const AgreementCard = ({
  name,
  description,
  region,
  tags = [],
  availableLeads,
  hotLeads,
  lastSyncAt,
  isSelected = false,
  onSelect,
  actionLabel,
  className = '',
  badgeVariant,
  ...cardProps
}) => {
  const formattedLastSync = lastSyncAt ? new Date(lastSyncAt).toLocaleString() : '—';
  const resolvedActionLabel = actionLabel ?? (isSelected ? 'Convênio selecionado' : 'Ativar leads');
  const resolvedBadgeVariant = badgeVariant ?? (isSelected ? 'secondary' : 'info');

  return (
    <Card
      className={`transition-colors duration-200 ${
        isSelected
          ? 'border-[color-mix(in_oklab,_var(--primary)_55%,_transparent)] shadow-[0_0_0_1px_rgba(99,102,241,0.35)]'
          : 'border-[var(--border)]'
      } ${className}`}
      {...cardProps}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">{name}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {region ? (
            <Badge variant={resolvedBadgeVariant}>
              <MapPin className="mr-1 h-3 w-3" />
              {region}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <div>
            <p className="text-muted-foreground">Leads disponíveis</p>
            <p className="text-lg font-semibold text-foreground">{availableLeads}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">Leads quentes</p>
            <p className="text-lg font-semibold text-foreground">{hotLeads}</p>
          </div>
        </div>
        {tags?.length ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">Atualizado em {formattedLastSync}</div>
        <Button size="sm" onClick={onSelect} variant={isSelected ? 'default' : 'outline'}>
          {resolvedActionLabel}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default AgreementCard;
