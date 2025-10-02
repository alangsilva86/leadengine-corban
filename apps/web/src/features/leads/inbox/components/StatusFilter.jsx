const STATUS_ORDER = ['all', 'contacted', 'won', 'lost'];

const STATUS_LABEL = {
  all: 'Todos',
  contacted: 'Em conversa',
  won: 'Venda realizada',
  lost: 'Sem interesse',
};

export const StatusFilter = ({ value, onChange }) => (
  <div className="inline-flex rounded-full bg-[rgba(148,163,184,0.12)] p-1 text-xs text-muted-foreground">
    {STATUS_ORDER.map((status) => (
      <button
        key={status}
        type="button"
        onClick={() => onChange(status)}
        className={`filter-pill ${value === status ? 'filter-pill--active' : ''}`}
      >
        {STATUS_LABEL[status]}
      </button>
    ))}
  </div>
);

export default StatusFilter;
