import { ChannelDistributionWidget } from './ChannelDistributionWidget';
const sampleData = [
    { name: 'WhatsApp', value: 55.2, color: 'var(--status-whatsapp)' },
    { name: 'Email', value: 21.4, color: 'var(--color-chart-1)' },
    { name: 'Telefone', value: 13.7, color: 'var(--color-chart-2)' },
    { name: 'Chat', value: 5.1, color: 'var(--color-chart-4)' },
    { name: 'Outros', value: 4.6, color: 'var(--muted)' },
];
const meta = {
    title: 'Dashboard/Widgets/ChannelDistributionWidget',
    component: ChannelDistributionWidget,
    args: {
        data: sampleData,
        loading: false,
    },
};
export default meta;
export const Default = {};
export const Loading = {
    args: {
        loading: true,
    },
};
export const Empty = {
    args: {
        data: [],
    },
};
