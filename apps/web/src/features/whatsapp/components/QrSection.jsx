import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { cn } from '@/lib/utils.js';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible.jsx';
import QrPreview from './QrPreview.jsx';
import Timeline from './Timeline.jsx';
import { CheckCircle2, ChevronDown, Link2, Loader2, QrCode } from 'lucide-react';

const QrSection = ({
  surfaceStyles,
  open,
  onOpenChange,
  qrImageSrc,
  isGeneratingQrImage,
  qrStatusMessage,
  onGenerate,
  onOpenQrDialog,
  generateDisabled,
  openDisabled,
  pairingPhoneInput,
  onPairingPhoneChange,
  pairingDisabled,
  requestingPairingCode,
  onRequestPairingCode,
  pairingPhoneError,
  timelineItems,
  realtimeConnected,
}) => {
  return (
    <Card className={cn(surfaceStyles.qrInstructionsPanel)}>
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code e instruções
            </CardTitle>
            <CardDescription>Escaneie com o aplicativo oficial para ativar a sessão.</CardDescription>
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
            <QrPreview
              className={cn('rounded-xl p-6', surfaceStyles.glassTileDashed)}
              illustrationClassName={surfaceStyles.qrIllustration}
              src={qrImageSrc}
              isGenerating={isGeneratingQrImage}
              statusMessage={qrStatusMessage}
              onGenerate={onGenerate}
              onOpen={onOpenQrDialog}
              generateDisabled={generateDisabled}
              openDisabled={openDisabled}
            />

            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                <p>Use o número que já interage com os clientes. Não é necessário chip ou aparelho adicional.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                <p>O Lead Engine garante distribuição automática. Você só recebe quando o servidor responde “quero falar”.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                <p>Se perder a conexão, repita o processo — seus leads permanecem reservados na sua inbox.</p>
              </div>
            </div>

            <div className={cn('space-y-3 rounded-xl p-4', surfaceStyles.glassTile)}>
              <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" /> Pareamento por código
                </span>
                <span className="text-[0.65rem] text-muted-foreground">Opcional</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Receba um código de 8 dígitos no aplicativo oficial para vincular sem escanear o QR Code.
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
                <Button
                  size="sm"
                  onClick={onRequestPairingCode}
                  disabled={pairingDisabled}
                >
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

            <Timeline
              surfaceStyles={surfaceStyles}
              items={timelineItems}
              realtimeConnected={realtimeConnected}
            />
          </CardContent>
          <CardFooter className="rounded-lg bg-muted/40 px-6 py-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Dica para evitar bloqueios</p>
            <p className="mt-1">
              Mantenha o aplicativo oficial aberto e responda às mensagens em até 15 minutos. A inteligência do Lead Engine cuida do aquecimento automático do número.
            </p>
          </CardFooter>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default QrSection;
