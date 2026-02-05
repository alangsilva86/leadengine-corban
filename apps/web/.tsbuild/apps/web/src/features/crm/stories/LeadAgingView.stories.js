import { jsx as _jsx } from "react/jsx-runtime";
import LeadAgingView from '../views/LeadAgingView';
import CrmStoryProviders from './CrmStoryProviders';
const meta = {
    title: 'CRM/Views/Aging',
    component: LeadAgingView,
    decorators: [
        (Story) => (_jsx(CrmStoryProviders, { children: _jsx("div", { className: "max-w-6xl p-6", children: _jsx(Story, {}) }) })),
    ],
};
export default meta;
export const Default = {};
