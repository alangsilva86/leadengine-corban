import { Badge } from '@/components/ui/badge.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { formatCurrency } from '@/features/agreements/utils/dailyCoefficient.js';

const SimulationOfferList = ({
  offers,
  currentParameters,
  fieldsDisabled,
  errors,
  onToggleOfferSelection,
  tableOptions = [],
  tableFilter = '',
  onTableFilterChange = () => {},
}) => (
  <div className="space-y-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h3 className="text-sm font-semibold text-foreground">Condições calculadas</h3>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {currentParameters?.windowLabel ? (
          <Badge variant="outline" className="text-xs">
            Janela {currentParameters.windowLabel}
          </Badge>
        ) : null}
        {tableOptions.length > 0 ? (
          <Select value={tableFilter} onValueChange={onTableFilterChange} disabled={fieldsDisabled}>
            <SelectTrigger className="w-full min-w-[200px] sm:w-48">
              <SelectValue placeholder="Todas as tabelas" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="">Todas as tabelas</SelectItem>
              {tableOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </div>
    {offers.length === 0 ? (
      <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
        Configure convênio, produto e parâmetros para gerar as condições automaticamente.
      </div>
    ) : (
      <div className="grid gap-4 lg:grid-cols-3">
        {offers.map((offer) => (
          <div
            key={offer.id}
            className="flex flex-col gap-3 rounded-xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/70 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{offer.bankName}</p>
                <p className="text-xs text-muted-foreground">
                  {offer.table || 'Tabela não informada'}
                  {offer.modality ? ` • ${offer.modality}` : ''}
                </p>
              </div>
              {offer.source === 'auto' ? (
                <Badge variant="outline" className="text-xs text-primary">
                  Automático
                </Badge>
              ) : null}
            </div>
            <div className="space-y-3">
              {offer.terms.map((term) => (
                <div key={term.id} className="rounded-lg border border-border/50 bg-background/70 p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <Checkbox
                        id={`${offer.id}-term-${term.id}`}
                        checked={term.selected}
                        onCheckedChange={(checked) => onToggleOfferSelection(offer.id, term.id, Boolean(checked))}
                        disabled={fieldsDisabled}
                      />
                      {term.term} meses
                    </label>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      coef {term.coefficient?.toFixed(4) ?? '—'}
                    </Badge>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-muted/60 p-2">
                      <dt className="text-muted-foreground">Parcela</dt>
                      <dd className="font-semibold text-foreground">{formatCurrency(term.installment ?? 0)}</dd>
                    </div>
                    <div className="rounded-md bg-muted/60 p-2">
                      <dt className="text-muted-foreground">Valor bruto</dt>
                      <dd className="font-semibold text-foreground">{formatCurrency(term.totalAmount ?? 0)}</dd>
                    </div>
                    <div className="rounded-md bg-muted/60 p-2">
                      <dt className="text-muted-foreground">Valor líquido</dt>
                      <dd className="font-semibold text-emerald-600">{formatCurrency(term.netAmount ?? 0)}</dd>
                    </div>
                    <div className="rounded-md bg-muted/60 p-2">
                      <dt className="text-muted-foreground">TAC</dt>
                      <dd className="font-semibold text-foreground">{formatCurrency(term.tacValue ?? 0)}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )}
    {errors?.selection ? <p className="text-sm text-destructive">{errors.selection}</p> : null}
  </div>
);

export default SimulationOfferList;
