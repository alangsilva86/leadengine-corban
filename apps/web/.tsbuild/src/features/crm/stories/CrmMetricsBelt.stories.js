import CrmMetricsBelt from '../components/CrmMetricsBelt';
const meta = {
    title: 'CRM/Metrics Belt',
    component: CrmMetricsBelt,
    args: {
        metrics: [
            { id: 'activeLeads', label: 'Leads ativos', unit: 'count', value: 120, delta: 8, deltaUnit: 'count', trend: 'up' },
            { id: 'slaCompliance', label: 'Dentro do SLA', unit: 'percentage', value: 84, delta: -3, deltaUnit: 'percentage', trend: 'down' },
            { id: 'avgResponseTime', label: '1ª resposta média', unit: 'duration', value: 54, delta: -6, deltaUnit: 'duration', trend: 'up' },
        ],
        source: 'api',
    },
};
export default meta;
export const Default = {};
export const Loading = {
    args: {
        loading: true,
    },
};
export const FallbackData = {
    args: {
        source: 'fallback',
    },
};
