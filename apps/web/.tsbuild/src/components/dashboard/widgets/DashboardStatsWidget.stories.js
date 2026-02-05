import { MessageSquare, Ticket, TrendingUp, Users } from 'lucide-react';
import { DashboardStatsWidget } from './DashboardStatsWidget';
const sampleStats = [
    {
        id: 'tickets',
        title: 'Tickets Ativos',
        value: '128',
        change: '+8,5%',
        trend: 'up',
        icon: Ticket,
        color: 'blue',
    },
    {
        id: 'leads',
        title: 'Leads Novos',
        value: '92',
        change: '+2,1%',
        trend: 'up',
        icon: Users,
        color: 'green',
    },
    {
        id: 'messages',
        title: 'Mensagens Hoje',
        value: '45',
        change: '-3,0%',
        trend: 'down',
        icon: MessageSquare,
        color: 'purple',
    },
    {
        id: 'conversion',
        title: 'Taxa de Conversão',
        value: '38,2%',
        change: '+1,2%',
        trend: 'up',
        icon: TrendingUp,
        color: 'orange',
    },
];
const meta = {
    title: 'Dashboard/Widgets/DashboardStatsWidget',
    component: DashboardStatsWidget,
    args: {
        stats: sampleStats,
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
