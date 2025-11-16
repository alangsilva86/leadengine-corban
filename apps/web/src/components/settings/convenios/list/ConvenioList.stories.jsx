import ConvenioList from './ConvenioList.jsx';

const meta = {
  title: 'Settings/Convenios/ConvenioList',
  component: ConvenioList,
  args: {
    convenios: [
      {
        id: '1',
        nome: 'Convênio Municipal',
        averbadora: 'Org Municipal',
        status: 'ATIVO',
        produtos: ['Consignado tradicional', 'Cartão benefício – Saque'],
        responsavel: 'Ana',
        archived: false,
      },
      {
        id: '2',
        nome: 'Convênio Estadual',
        averbadora: 'Secretaria Estadual',
        status: 'EM_IMPLANTACAO',
        produtos: [],
        responsavel: 'Bruno',
        archived: true,
      },
    ],
    selectedId: '1',
    onSelect: () => {},
    onArchive: () => {},
    readOnly: false,
    onCreate: () => {},
    onOpenImport: () => {},
    onRefresh: () => {},
    isLoading: false,
    isFetching: false,
  },
};

export default meta;

export const Default = {};
