import { Paperclip } from 'lucide-react';

export const AttachmentPreview = ({ attachments = [] }) => {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((attachment) => {
        const key = attachment.id ?? attachment.url ?? attachment.name ?? Math.random();
        const label = attachment.name ?? attachment.fileName ?? 'Anexo';
        const href = attachment.url ?? attachment.href;
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-slate-700/60 bg-slate-900/60 px-2 py-1 text-xs text-slate-200 hover:border-slate-500 hover:bg-slate-800"
          >
            <Paperclip className="h-4 w-4 text-slate-400" />
            <span className="truncate max-w-[140px]">{label}</span>
          </a>
        );
      })}
    </div>
  );
};

export default AttachmentPreview;
