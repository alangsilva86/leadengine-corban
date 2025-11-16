import BasicInformation from './forms/BasicInformation.jsx';
import CalendarCard from './calendar/CalendarCard.jsx';
import TaxesCard from './taxes/TaxesCard.jsx';
import SimulationPreview from './simulation/SimulationPreview.jsx';
import HistoryCard from './history/HistoryCard.jsx';

const ConvenioDetails = ({ convenio, onUpdateBasic, onUpsertWindow, onRemoveWindow, onUpsertTax, readOnly }) => {
  if (!convenio) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
        Selecione um convênio para editar dados, calendário e taxas.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BasicInformation
        initialValues={{
          nome: convenio.nome,
          averbadora: convenio.averbadora,
          tipo: convenio.tipo,
          status: convenio.status,
          produtos: convenio.produtos,
          responsavel: convenio.responsavel,
        }}
        onSave={onUpdateBasic}
        disabled={readOnly}
      />
      <CalendarCard windows={convenio.janelas} onUpsert={onUpsertWindow} onRemove={onRemoveWindow} readOnly={readOnly} />
      <TaxesCard products={convenio.produtos} taxes={convenio.taxas} onUpsert={onUpsertTax} readOnly={readOnly} />
      <SimulationPreview products={convenio.produtos} windows={convenio.janelas} taxes={convenio.taxas} />
      <HistoryCard history={convenio.history ?? []} />
    </div>
  );
};

export default ConvenioDetails;
