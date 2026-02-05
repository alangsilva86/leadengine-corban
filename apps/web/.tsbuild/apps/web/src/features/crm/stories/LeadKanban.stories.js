import StageColumn from '../components/kanban/StageColumn';
const sampleLeads = [
    {
        id: 'lead-1',
        name: 'Clínica Aurora',
        stage: 'qualification',
        ownerId: 'owner:me',
        ownerName: 'Você',
        lastActivityAt: new Date().toISOString(),
        source: 'web',
        channel: 'whatsapp',
        potentialValue: 12000,
        status: 'in_progress',
    },
    {
        id: 'lead-2',
        name: 'Farmácia Centro',
        stage: 'qualification',
        ownerId: 'owner:team',
        ownerName: 'Equipe Norte',
        lastActivityAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
        source: 'ads',
        channel: 'email',
        potentialValue: 8000,
        status: 'in_progress',
    },
];
const meta = {
    title: 'CRM/Kanban Stage Column',
    component: StageColumn,
    args: {
        stageId: 'qualification',
        title: 'Qualificação',
        leads: sampleLeads,
        metrics: { totalPotential: 20000, stalledCount: 1 },
    },
};
export default meta;
export const Default = {};
export const Empty = {
    args: {
        leads: [],
        metrics: { totalPotential: 0, stalledCount: 0 },
    },
};
