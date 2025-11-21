import { Clock, Loader2, QrCode, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils.js';
import PropTypes from 'prop-types';

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

const resolvePreset = (size) => {
  if (!size) return SIZE_PRESETS[44];

  const parsed = typeof size === 'string' ? Number.parseInt(size, 10) : size;

  if (typeof parsed === 'number' && SIZE_PRESETS[parsed]) {
    return SIZE_PRESETS[parsed];
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
}) => {
  const preset = resolvePreset(size);
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
          <img src={src} alt="QR Code do WhatsApp" className={cn('rounded-lg shadow-inner', preset.image)} />
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

QrPreview.propTypes = {
  src: PropTypes.string,
  isGenerating: PropTypes.bool,
  statusMessage: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  onGenerate: PropTypes.func,
  onOpen: PropTypes.func,
  generateDisabled: PropTypes.bool,
  openDisabled: PropTypes.bool,
  className: PropTypes.string,
  illustrationClassName: PropTypes.string,
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

export default QrPreview;
