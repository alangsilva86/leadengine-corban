import HistoryCard from './HistoryCard.jsx';

const meta = {
  title: 'Settings/Convenios/HistoryCard',
  component: HistoryCard,
  args: {
    history: [
      { id: '1', message: 'Dados básicos atualizados', author: 'Ana', createdAt: new Date('2024-01-01') },
      { id: '2', message: 'Nova janela cadastrada', author: 'Bruno', createdAt: new Date('2024-02-10') },
    ],
  },
};

export default meta;

export const Default = {};
export const Empty = {
  args: {
    history: [],
  },
};
