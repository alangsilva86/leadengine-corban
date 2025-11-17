import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.jsx';

const QueueAlerts = ({ alerts = [], disabledReason = null }) => {
  if (!Array.isArray(alerts) || alerts.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Fila padrão indisponível</AlertTitle>
      <AlertDescription>
        {disabledReason ? <p className="text-sm text-muted-foreground">{disabledReason}</p> : null}
        <ul className="mt-2 space-y-1 text-sm">
          {alerts.map((alert) => (
            <li key={alert.index}>
              {alert.message}
              {alert.instanceId ? (
                <span className="text-muted-foreground"> — Instância afetada: {alert.instanceId}</span>
              ) : null}
              {alert.reason ? <span className="block text-muted-foreground">Motivo: {alert.reason}</span> : null}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
};

export default QueueAlerts;
