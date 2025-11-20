import { useMemo } from 'react';
import { Clock, Loader2, QrCode, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils.js';
import type { ReactNode } from 'react';

const SIZE_PRESETS = {
  44: {
    container: 'h-44 w-44',
    image: 'h-36 w-36',
    spinner: 'h-12 w-12',
    icon: 'h-24 w-24',
  },
  64: {
    container: 'h-64 w-64',
    image: 'h-56 w-56',
    spinner: 'h-16 w-16',
    icon: 'h-32 w-32',
  },
};

type SizePresetKey = keyof typeof SIZE_PRESETS;

type QrPreviewProps = {
  src?: string | null | undefined;
  isGenerating?: boolean;
  statusMessage?: ReactNode | null | undefined;
  onGenerate?: (() => void | Promise<void>) | null | undefined;
  onOpen?: (() => void | Promise<void>) | null | undefined;
  generateDisabled?: boolean;
  openDisabled?: boolean;
  className?: string;
  illustrationClassName?: string;
  size?: SizePresetKey | number | string | null | undefined;
};

const resolvePreset = (size?: QrPreviewProps['size']) => {
  if (!size) return SIZE_PRESETS[44];

  if (typeof size === 'number' && SIZE_PRESETS[size as SizePresetKey]) {
    return SIZE_PRESETS[size as SizePresetKey];
  }

  if (typeof size === 'string') {
    const parsed = Number.parseInt(size, 10);
    if (Number.isFinite(parsed) && SIZE_PRESETS[parsed as SizePresetKey]) {
      return SIZE_PRESETS[parsed as SizePresetKey];
    }
  }

  return SIZE_PRESETS[44];
};

const QrPreview = ({
  src,
  isGenerating = false,
  statusMessage = null,
  onGenerate = null,
  onOpen = null,
  generateDisabled = false,
  openDisabled = false,
  className,
  illustrationClassName,
  size = 44,
}: QrPreviewProps) => {
  const preset = useMemo(() => resolvePreset(size), [size]);
  const hasQr = Boolean(src);
  const showStatus = Boolean(statusMessage);
  const showActions = Boolean(onGenerate) || Boolean(onOpen);

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-2xl',
          preset.container,
          illustrationClassName
        )}
      >
        {hasQr ? (
          <img src={src ?? undefined} alt="QR Code do WhatsApp" className={cn('rounded-lg shadow-inner', preset.image)} />
        ) : isGenerating ? (
          <Loader2 className={cn('animate-spin', preset.spinner)} />
        ) : (
          <QrCode className={preset.icon} />
        )}
      </div>

      {showStatus ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
          <Clock className="h-3.5 w-3.5" />
          {statusMessage}
        </div>
      ) : null}

      {showActions ? (
        <div className="flex flex-wrap justify-center gap-2">
          {onGenerate ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void onGenerate?.()}
              disabled={generateDisabled}
            >
              <RefreshCcw className="mr-2 h-4 w-4" /> Gerar novo QR
            </Button>
          ) : null}
          {onOpen ? (
            <Button size="sm" variant="outline" onClick={onOpen} disabled={openDisabled}>
              Abrir em tela cheia
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default QrPreview;
