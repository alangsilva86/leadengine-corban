import { Button } from '@/components/ui/button.jsx';

export const QuickReplyList = ({ replies = [], onSelect, className }) => {
  if (!replies || replies.length === 0) {
    return null;
  }

  return (
    <div className={className ?? 'flex flex-wrap gap-2'}>
      {replies.map((reply) => {
        const key = typeof reply === 'string' ? reply : reply?.id ?? reply?.label;
        const label = typeof reply === 'string' ? reply : reply?.label ?? reply?.text ?? 'Resposta rápida';
        const value = typeof reply === 'string' ? reply : reply?.text ?? reply?.value ?? label;
        return (
          <Button
            key={key}
            variant="outline"
            size="sm"
            className="border-dashed border-slate-500/40 bg-slate-950/40 text-slate-200 hover:bg-slate-900"
            onClick={() => {
              if (typeof onSelect === 'function') {
                onSelect(value, reply);
              }
            }}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
};

export default QuickReplyList;
