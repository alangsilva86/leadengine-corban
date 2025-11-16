import BasicInformation from './BasicInformation.jsx';

const meta = {
  title: 'Settings/Convenios/BasicInformation',
  component: BasicInformation,
  args: {
    initialValues: {
      nome: 'Convênio Municipal',
      averbadora: 'Org Municipal',
      tipo: 'MUNICIPAL',
      status: 'ATIVO',
      produtos: ['Consignado tradicional'],
      responsavel: 'Ana',
    },
    disabled: false,
    onSave: () => {},
  },
};

export default meta;

export const Default = {};
export const ReadOnly = {
  args: {
    disabled: true,
  },
};
