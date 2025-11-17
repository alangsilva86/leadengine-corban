import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.jsx';
import { AlertTriangle } from 'lucide-react';
import TermSelector from './TermSelector.jsx';
import { NO_STAGE_VALUE } from '@/features/chat/utils/simulation.js';

const CALCULATION_MODE_OPTIONS = [
  {
    value: 'margin',
    label: 'Margem disponível',
    description: 'Informe a parcela/margem mensal disponível do cliente.',
  },
  {
    value: 'net',
    label: 'Valor líquido desejado',
    description: 'Calcular automaticamente a margem necessária para liberar um líquido.',
  },
];

const CalculationIssues = ({ issues }) => {
  if (!Array.isArray(issues) || issues.length === 0) {
    return null;
  }
  return (
    <Alert variant="warning" className="border-amber-400/60 bg-amber-50 text-amber-900">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Não foi possível gerar todas as condições</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
};

const SimulationForm = ({
  errors,
  convenioId,
  onConvenioChange,
  agreementOptions,
  hasAgreementOptions,
  fieldsDisabled,
  productId,
  onProductChange,
  productOptions,
  simulationDateInput,
  onSimulationDateChange,
  calculationMode,
  onCalculationModeChange,
  baseValueInput,
  onBaseValueInputChange,
  availableTermOptions,
  selectedTerms,
  onToggleTerm,
  customTermInput,
  onCustomTermInputChange,
  onAddCustomTerm,
  calculationIssues,
  stage,
  stageOptions,
  onStageChange,
  leadId,
  onLeadIdChange,
  simulationId,
  onSimulationIdChange,
  metadataText,
  onMetadataChange,
}) => (
  <div className="mt-4 space-y-6">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="sales-convenio">Convênio</Label>
        {errors.convenio ? <p className="text-xs text-rose-400">{errors.convenio}</p> : null}
        <Select value={convenioId} onValueChange={onConvenioChange} disabled={fieldsDisabled}>
          <SelectTrigger id="sales-convenio">
            <SelectValue placeholder={hasAgreementOptions ? 'Selecione um convênio' : 'Nenhum convênio disponível'} />
          </SelectTrigger>
          <SelectContent>
            {hasAgreementOptions ? (
              agreementOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="__empty__" disabled>
                Nenhum convênio disponível
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        {errors.convenio ? <p className="text-sm text-destructive">{errors.convenio}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="sales-product">Produto</Label>
        {errors.product ? <p className="text-xs text-rose-400">{errors.product}</p> : null}
        <Select value={productId} onValueChange={onProductChange} disabled={fieldsDisabled || !convenioId}>
          <SelectTrigger id="sales-product">
            <SelectValue
              placeholder={
                !convenioId
                  ? 'Selecione um convênio primeiro'
                  : productOptions.length > 0
                      ? 'Selecione um produto'
                      : 'Nenhum produto disponível'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {!convenioId ? (
              <SelectItem value="__select-convenio__" disabled>
                Selecione um convênio primeiro
              </SelectItem>
            ) : productOptions.length > 0 ? (
              productOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="__no-products__" disabled>
                Nenhum produto disponível para este convênio
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        {errors.product ? <p className="text-sm text-destructive">{errors.product}</p> : null}
        {convenioId && productOptions.length === 0 ? (
          <p className="text-xs text-foreground-muted">
            Este convênio ainda não possui produtos configurados. Atualize as configurações para continuar.
          </p>
        ) : null}
      </div>
      {!hasAgreementOptions ? (
        <p className="text-xs text-foreground-muted">
          Nenhum convênio disponível no momento. Configure um convênio para liberar o cadastro.
        </p>
      ) : null}
      <div className="space-y-2">
        <Label>Data da simulação</Label>
        <Input type="date" value={simulationDateInput} onChange={onSimulationDateChange} disabled={fieldsDisabled} />
        <p className="text-xs text-muted-foreground">
          Usada para validar a janela vigente e a vigência das taxas configuradas.
        </p>
      </div>
    </div>

    <div className="rounded-xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/60 p-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label>Base de cálculo</Label>
          <RadioGroup
            value={calculationMode}
            onValueChange={onCalculationModeChange}
            className="grid gap-2 sm:grid-cols-2"
            disabled={fieldsDisabled}
          >
            {CALCULATION_MODE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm shadow-sm"
              >
                <RadioGroupItem value={option.value} />
                <div>
                  <p className="font-medium text-foreground">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>
        <div className="space-y-2">
          <Label>{calculationMode === 'margin' ? 'Margem disponível (R$)' : 'Valor líquido desejado (R$)'}</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={baseValueInput}
            onChange={onBaseValueInputChange}
            placeholder={calculationMode === 'margin' ? 'Ex.: 350' : 'Ex.: 5000'}
            disabled={fieldsDisabled}
          />
          <p className="text-xs text-muted-foreground">
            {calculationMode === 'margin'
              ? 'Valor da parcela disponível para consignar.'
              : 'Valor líquido que o cliente espera receber.'}
          </p>
        </div>
      </div>
      <TermSelector
        options={availableTermOptions}
        selectedTerms={selectedTerms}
        disabled={fieldsDisabled}
        onToggleTerm={onToggleTerm}
        customTermInput={customTermInput}
        onCustomTermInputChange={onCustomTermInputChange}
        onAddCustomTerm={onAddCustomTerm}
      />
      <div className="mt-4">
        <CalculationIssues issues={calculationIssues} />
      </div>
    </div>

    <Accordion type="single" collapsible className="rounded-xl border border-border/60 bg-muted/10">
      <AccordionItem value="advanced">
        <AccordionTrigger className="px-4">Opções avançadas</AccordionTrigger>
        <AccordionContent className="px-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Etapa (opcional)</Label>
              <Select value={stage} onValueChange={onStageChange} disabled={fieldsDisabled || stageOptions.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="__none__" value={NO_STAGE_VALUE}>
                    Sem alteração
                  </SelectItem>
                  {stageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Lead (opcional)</Label>
              <Input
                value={leadId}
                onChange={onLeadIdChange}
                placeholder="Identificador do lead"
                disabled={fieldsDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Simulação (opcional)</Label>
              <Input
                value={simulationId}
                onChange={onSimulationIdChange}
                placeholder="Identificador da simulação"
                disabled={fieldsDisabled}
              />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label>Metadata (JSON opcional)</Label>
            <Textarea
              value={metadataText}
              onChange={onMetadataChange}
              placeholder="{ }"
              className="font-mono text-xs"
              rows={4}
              disabled={fieldsDisabled}
            />
            {errors.metadata ? <p className="text-sm text-destructive">{errors.metadata}</p> : null}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
);

export default SimulationForm;
