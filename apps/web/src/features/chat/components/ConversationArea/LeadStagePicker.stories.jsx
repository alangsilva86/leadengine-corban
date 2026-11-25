import { useState } from 'react';
import LeadStagePicker from './LeadStagePicker.jsx';

const meta = {
  title: 'Features/Chat/Conversation Header/LeadStagePicker',
  component: LeadStagePicker,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Seletor da etapa do lead (funil único do contrato `@ticketz/contracts`): 7 etapas como progresso e as saídas Ganho, Perdido e Reciclar. Transições proibidas ficam desabilitadas, com o motivo.',
      },
    },
  },
};

export default meta;

const Interactive = ({ initial }) => {
  const [stage, setStage] = useState(initial);
  return (
    <div className="w-80 rounded-lg border border-border bg-popover p-3">
      <LeadStagePicker stage={stage} onChange={setStage} />
    </div>
  );
};

export const Qualificacao = { render: () => <Interactive initial="qualificacao" /> };

export const Perdido = {
  render: () => <Interactive initial="perdido" />,
  parameters: { docs: { description: { story: 'Lead perdido só pode voltar para Reciclar.' } } },
};

export const ValorAntigo = {
  render: () => <Interactive initial="documentos_averbacao" />,
  parameters: { docs: { description: { story: 'Valores antigos do Inbox são normalizados (aqui: Averbação).' } } },
};
