import AgreementCard from './AgreementCard.jsx';
import AgreementCardSkeleton from './AgreementCardSkeleton.jsx';

export default {
  title: 'Components/Agreements/AgreementCard',
  component: AgreementCard,
};

const baseArgs = {
  name: 'Convênio São Paulo',
  description: 'Atendimento completo em São Paulo e região metropolitana.',
  region: 'São Paulo - SP',
  availableLeads: 128,
  hotLeads: 34,
  tags: ['Saúde', 'Dental', 'Empresarial'],
  lastSyncAt: new Date().toISOString(),
};

const Template = (args) => <AgreementCard {...args} />;

export const Default = Template.bind({});
Default.args = {
  ...baseArgs,
  isSelected: false,
};

export const Selected = Template.bind({});
Selected.args = {
  ...baseArgs,
  isSelected: true,
};

export const Skeleton = () => <AgreementCardSkeleton />;
