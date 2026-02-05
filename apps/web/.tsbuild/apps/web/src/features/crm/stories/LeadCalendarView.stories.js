import { jsx as _jsx } from "react/jsx-runtime";
import LeadCalendarView from '../views/LeadCalendarView';
import CrmStoryProviders from './CrmStoryProviders';
const meta = {
    title: 'CRM/Views/Calendar',
    component: LeadCalendarView,
    decorators: [
        (Story) => (_jsx(CrmStoryProviders, { children: _jsx("div", { className: "max-w-5xl p-6", children: _jsx(Story, {}) }) })),
    ],
};
export default meta;
export const Default = {};
