import { TicketsDailyWidget } from './TicketsDailyWidget';
const sampleData = [
    { name: 'Seg', abertos: 12, pendentes: 6, fechados: 8 },
    { name: 'Ter', abertos: 9, pendentes: 4, fechados: 10 },
    { name: 'Qua', abertos: 14, pendentes: 7, fechados: 12 },
    { name: 'Qui', abertos: 11, pendentes: 5, fechados: 9 },
    { name: 'Sex', abertos: 8, pendentes: 3, fechados: 7 },
];
const meta = {
    title: 'Dashboard/Widgets/TicketsDailyWidget',
    component: TicketsDailyWidget,
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
