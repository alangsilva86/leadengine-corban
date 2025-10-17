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
            className="border-dashed border-[color:var(--color-inbox-border)]/80 bg-[color:var(--surface-overlay-inbox-quiet)] text-[color:var(--color-inbox-foreground)] hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_92%,transparent)]"
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
