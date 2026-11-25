import { FileText, Image as ImageIcon, Music, Video, X } from 'lucide-react';

const iconFor = (type = '') => {
  if (type.startsWith('image/')) return ImageIcon;
  if (type.startsWith('video/')) return Video;
  if (type.startsWith('audio/')) return Music;
  return FileText;
};

const formatSize = (bytes) => {
  if (typeof bytes !== 'number') return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
};

/** Anexos escolhidos, antes do envio. */
const AttachmentTray = ({ attachments = [], onRemove, disabled = false }) => {
  if (attachments.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2 px-3 pt-2" aria-label="Anexos">
      {attachments.map((file) => {
        const Icon = iconFor(file.type);
        return (
          <li
            key={file.id}
            className="flex max-w-full items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground"
          >
            <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="max-w-48 truncate">{file.name}</span>
            <span className="shrink-0 text-muted-foreground">{formatSize(file.size)}</span>
            <button
              type="button"
              className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onRemove?.(file.id)}
              disabled={disabled}
              aria-label={`Remover anexo ${file.name}`}
            >
              <X className="size-3" aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default AttachmentTray;
