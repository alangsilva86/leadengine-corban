import { jsx as _jsx } from "react/jsx-runtime";
import LeadInsightsView from '../views/LeadInsightsView';
import CrmStoryProviders from './CrmStoryProviders';
const meta = {
    title: 'CRM/Views/Insights',
    component: LeadInsightsView,
    decorators: [
        (Story) => (_jsx(CrmStoryProviders, { children: _jsx("div", { className: "p-6", children: _jsx(Story, {}) }) })),
    ],
};
export default meta;
export const Default = {};
