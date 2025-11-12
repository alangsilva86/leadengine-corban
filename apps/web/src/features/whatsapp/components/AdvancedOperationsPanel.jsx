import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible.jsx';
import Timeline from './Timeline.jsx';
import { ChevronDown, Link2, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils.js';

const AdvancedOperationsPanel = ({
  surfaceStyles,
  open,
  onOpenChange,
  qrStatusMessage,
  timelineItems,
  realtimeConnected,
  pairingPhoneInput,
  pairingPhoneError,
  pairingDisabled,
  requestingPairingCode,
  onPairingPhoneChange,
  onRequestPairingCode,
}) => (
  <Card className={cn(surfaceStyles.qrInstructionsPanel)}>
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="h-5 w-5" />
            Operações avançadas
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Acompanhe eventos quase em tempo real e, se necessário, faça o pareamento manual.
          </p>
        </div>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'ml-auto inline-flex items-center gap-2 text-xs uppercase tracking-wide transition-transform',
              open ? 'rotate-180' : ''
            )}
          >
            <ChevronDown className="h-4 w-4" />
            {open ? 'Recolher' : 'Expandir'}
          </Button>
        </CollapsibleTrigger>
      </CardHeader>
      <CollapsibleContent>
        <CardContent className="space-y-6">
          {qrStatusMessage ? (
            <div className="rounded-xl border border-dashed border-surface-overlay-glass-border bg-surface-overlay-quiet p-3 text-xs text-muted-foreground">
              {qrStatusMessage}
            </div>
          ) : null}

          <Timeline surfaceStyles={surfaceStyles} items={timelineItems} realtimeConnected={realtimeConnected} />

          <div className={cn('space-y-3 rounded-xl p-4', surfaceStyles.glassTile)}>
            <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <span className="flex items-center gap-2">
                <Link2 className="h-4 w-4" /> Pareamento por código
              </span>
              <span className="text-[0.65rem] text-muted-foreground">Opcional</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Receba um código numérico no WhatsApp oficial quando a opção “Conectar com código” estiver disponível.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={pairingPhoneInput}
                onChange={onPairingPhoneChange}
                placeholder="DDD + número"
                inputMode="tel"
                autoComplete="tel"
                disabled={pairingDisabled}
              />
              <Button size="sm" onClick={onRequestPairingCode} disabled={pairingDisabled}>
                {requestingPairingCode ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Solicitando…
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-3.5 w-3.5" /> Parear por código
                  </>
                )}
              </Button>
            </div>
            {pairingPhoneError ? (
              <p className="text-xs text-destructive">{pairingPhoneError}</p>
            ) : (
              <p className="text-[0.7rem] text-muted-foreground">
                No WhatsApp: Configurações &gt; Dispositivos conectados &gt; Conectar com código.
              </p>
            )}
          </div>
        </CardContent>
      </CollapsibleContent>
    </Collapsible>
  </Card>
);

export default AdvancedOperationsPanel;
