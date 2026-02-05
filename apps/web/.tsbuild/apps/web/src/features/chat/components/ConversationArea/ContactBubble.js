import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Phone } from 'lucide-react';
const resolveContactName = (contact) => contact?.name ?? contact?.fullName ?? contact?.displayName ?? contact?.formattedName ?? 'Contato';
const resolveContactPhones = (contact) => {
    if (Array.isArray(contact?.phones)) {
        return contact.phones;
    }
    if (typeof contact?.phone === 'string' && contact.phone.trim().length > 0) {
        return [contact.phone];
    }
    return [];
};
export const ContactBubble = ({ contacts = [], caption }) => (_jsxs("div", { className: "flex flex-col gap-2", children: [contacts.map((contact, index) => {
            const name = resolveContactName(contact);
            const phones = resolveContactPhones(contact);
            return (_jsxs("div", { className: "flex flex-col gap-1 rounded-lg bg-surface-overlay-quiet px-3 py-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Phone, { className: "h-3.5 w-3.5 text-foreground", "aria-hidden": "true" }), _jsx("span", { className: "text-sm font-medium text-foreground", children: name })] }), phones.length > 0 ? (_jsx("ul", { className: "ml-5 list-disc text-xs text-foreground-muted", children: phones.map((phone, phoneIndex) => (_jsx("li", { children: phone }, `${name}-${phoneIndex}`))) })) : null, contact?.org ? _jsx("span", { className: "text-xs text-foreground-muted", children: contact.org }) : null] }, `${name}-${index}`));
        }), caption ? _jsx("p", { className: "text-xs text-foreground-muted", children: caption }) : null] }));
export default ContactBubble;
