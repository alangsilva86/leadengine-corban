import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const TemplateBubble = ({ template, caption }) => {
    const name = typeof template?.name === 'string' ? template.name : null;
    const language = typeof template?.language === 'string' ? template.language : null;
    const components = Array.isArray(template?.components) ? template.components : [];
    return (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("div", { className: "flex flex-col gap-1 rounded-lg bg-surface-overlay-quiet px-3 py-2", children: [_jsx("span", { className: "text-[10px] font-semibold uppercase tracking-wide text-foreground-muted", children: "Mensagem modelo" }), name ? _jsx("span", { className: "text-sm font-medium text-foreground", children: name }) : null, language ? _jsxs("span", { className: "text-xs text-foreground-muted", children: ["Idioma: ", language] }) : null, components.length > 0 ? (_jsx("ul", { className: "ml-4 list-disc text-xs text-foreground-muted", children: components.map((component, index) => (_jsxs("li", { children: [component?.type ?? 'Componente', component?.text ? `: ${component.text}` : ''] }, `component-${index}`))) })) : null] }), caption ? _jsx("p", { className: "text-xs text-foreground-muted", children: caption }) : null] }));
};
export default TemplateBubble;
