import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
const ContactDataView = ({ contact }) => (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Dados completos" }) }), _jsx(CardContent, { children: contact ? (_jsx("pre", { className: "max-h-[420px] overflow-auto rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground", children: JSON.stringify(contact, null, 2) })) : (_jsx("p", { className: "text-sm text-muted-foreground", children: "Selecione um contato para visualizar os dados brutos." })) })] }));
export default ContactDataView;
