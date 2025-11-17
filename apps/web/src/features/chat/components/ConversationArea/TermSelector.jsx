import { Plus } from 'lucide-react';
import { Label } from '@/components/ui/label.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Button } from '@/components/ui/button.jsx';

const TermSelector = ({
  options = [],
  selectedTerms = [],
  disabled = false,
  onToggleTerm,
  customTermInput = '',
  onCustomTermInputChange,
  onAddCustomTerm,
}) => (
  <div className="mt-4 space-y-3">
    <Label>Prazos desejados</Label>
    <div className="flex flex-wrap gap-2">
      {options.map((term) => {
        const checked = selectedTerms.includes(term);
        return (
          <label
            key={term}
            className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-sm"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => onToggleTerm?.(term, Boolean(value))}
              disabled={disabled}
            />
            {term} meses
          </label>
        );
      })}
    </div>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-2">
        <Input
          type="number"
          min="1"
          step="1"
          value={customTermInput}
          onChange={(event) => onCustomTermInputChange?.(event.target.value)}
          placeholder="Adicionar prazo manual"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddCustomTerm}
          disabled={disabled || !customTermInput}
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Combine prazos diferentes para comparar as tabelas dos bancos.</p>
    </div>
  </div>
);

export default TermSelector;
