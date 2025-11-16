import SimulationPreview from './SimulationPreview.jsx';

const today = new Date();
const windows = [
  { id: '1', label: 'Atual', start: today, end: new Date(today.getTime() + 7 * 86400000), firstDueDate: new Date(today.getTime() + 9 * 86400000) },
];
const taxes = [
  {
    id: '1',
    produto: 'Consignado tradicional',
    modalidade: 'NORMAL',
    monthlyRate: 2.3,
    tacPercent: 0,
    tacFlat: 0,
    validFrom: new Date(today.getTime() - 86400000),
    validUntil: null,
    status: 'Ativa',
  },
];

const meta = {
  title: 'Settings/Convenios/SimulationPreview',
  component: SimulationPreview,
  args: {
    products: ['Consignado tradicional'],
    windows,
    taxes,
  },
};

export default meta;

export const Default = {};
export const MissingData = {
  args: {
    windows: [],
    taxes: [],
  },
};
