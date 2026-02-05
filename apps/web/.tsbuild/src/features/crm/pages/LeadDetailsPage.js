import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useParams } from 'react-router-dom';
const LeadDetailsPage = () => {
    const { leadId } = useParams();
    return (_jsxs("div", { className: "flex h-full flex-col gap-4", children: [_jsxs("header", { children: [_jsxs("h1", { className: "text-2xl font-semibold text-foreground", children: ["Lead ", leadId] }), _jsx("p", { className: "text-muted-foreground", children: "Detalhes aprofundados do lead ser\u00E3o exibidos aqui conforme as etapas futuras do CRM forem implementadas." })] }), _jsx("div", { className: "rounded-lg border border-dashed border-border/80 p-6 text-sm text-muted-foreground", children: "Placeholder do drawer e conte\u00FAdo detalhado do lead." })] }));
};
export default LeadDetailsPage;
