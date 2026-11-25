import { AlertTriangle, Loader2, PauseCircle, QrCode, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils.js';

export type QrPreviewPhase = 'idle' | 'loading' | 'ready' | 'paused' | 'error';

interface QrPreviewProps {
  phase: QrPreviewPhase;
  src?: string | null;
  /** Segundos até a próxima renovação automática. */
  secondsLeft?: number | null;
  errorMessage?: string | null;
  onRegenerate?: () => void;
  /** Lado do quadrado em px (mínimo recomendado para leitura pela câmera: 264). */
  size?: number;
  className?: string;
}

/**
 * Quadro do QR Code com estados de carregamento, pausa e erro.
 * O QR fica sempre sobre fundo branco (requisito de leitura), inclusive no tema escuro.
 */
const QrPreview = ({
  phase,
  src = null,
  secondsLeft = null,
  errorMessage = null,
  onRegenerate,
  size = 264,
  className,
}: QrPreviewProps) => {
  const showImage = phase === 'ready' && Boolean(src);

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        className="relative flex items-center justify-center overflow-hidden rounded-xl border border-border bg-surface shadow-xs"
        style={{ width: size + 24, height: size + 24 }}
      >
        {showImage ? (
          // O QR precisa de fundo claro para ser lido: usamos o branco do próprio PNG.
          <img
            src={src ?? undefined}
            alt="QR Code para conectar o WhatsApp"
            width={size}
            height={size}
            className="rounded-md [image-rendering:pixelated]"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            {phase === 'paused' ? (
              <>
                <PauseCircle aria-hidden="true" className="size-8 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">QR pausado</p>
                  <p className="text-xs text-muted-foreground">Paramos de renovar para economizar. Gere um novo quando estiver com o celular em mãos.</p>
                </div>
              </>
            ) : phase === 'error' ? (
              <>
                <AlertTriangle aria-hidden="true" className="size-8 text-danger" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Não foi possível gerar o QR Code</p>
                  {errorMessage ? <p className="text-xs text-muted-foreground">{errorMessage}</p> : null}
                </div>
              </>
            ) : phase === 'loading' ? (
              <>
                <Loader2 aria-hidden="true" className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Gerando QR Code…</p>
              </>
            ) : (
              <QrCode aria-hidden="true" className="size-16 text-subtle-foreground" />
            )}
          </div>
        )}
      </div>

      {phase === 'ready' && typeof secondsLeft === 'number' ? (
        <p className="text-xs tabular-nums text-muted-foreground">
          {secondsLeft > 0 ? `Atualiza em ${secondsLeft}s` : 'Atualizando…'}
        </p>
      ) : null}

      {(phase === 'paused' || phase === 'error') && onRegenerate ? (
        <Button type="button" variant="outline" size="sm" onClick={onRegenerate}>
          <RefreshCw aria-hidden="true" />
          Gerar novo QR
        </Button>
      ) : null}
    </div>
  );
};

export default QrPreview;
