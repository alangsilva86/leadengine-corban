import { useState } from 'react';
import TaxesCard from './TaxesCard.jsx';
import TaxDialog from './TaxDialog.jsx';

const sampleTaxes = [
  {
    id: 'tax-1',
    produto: 'Consignado tradicional',
    modalidade: 'NORMAL',
    monthlyRate: 2.4,
    tacPercent: 0.5,
    tacFlat: 0,
    validFrom: new Date('2024-01-01'),
    validUntil: null,
    status: 'Ativa',
  },
];

const meta = {
  title: 'Settings/Convenios/Taxes',
};

export default meta;

export const Table = {
  render: () => {
    const [taxes, setTaxes] = useState(sampleTaxes);
    return (
      <TaxesCard
        products={['Consignado tradicional']}
        taxes={taxes}
        onUpsert={(payload) => setTaxes((current) => current.some((tax) => tax.id === payload.id) ? current.map((tax) => (tax.id === payload.id ? payload : tax)) : [...current, payload])}
        readOnly={false}
      />
    );
  },
};

export const Dialog = {
  render: () => <TaxDialog open onClose={() => {}} onSubmit={() => {}} initialValue={sampleTaxes[0]} disabled={false} />,
};
