import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const TYPOGRAPHY_SCALE = [
    {
        name: 'Display',
        className: 'text-4xl font-semibold tracking-tight',
        description: 'Usado em números-chave e cabeçalhos hero.',
    },
    {
        name: 'Heading XL',
        className: 'text-3xl font-semibold tracking-tight',
        description: 'Títulos principais de seções ou painéis.',
    },
    {
        name: 'Heading LG',
        className: 'text-2xl font-semibold tracking-tight',
        description: 'Subtítulos e cabeçalhos de cartões.',
    },
    {
        name: 'Heading MD',
        className: 'text-xl font-semibold tracking-tight',
        description: 'Blocos de conteúdo e listagens.',
    },
    {
        name: 'Heading SM',
        className: 'text-lg font-semibold tracking-tight',
        description: 'Elementos densos como listas e tabelas.',
    },
    {
        name: 'Body',
        className: 'text-base leading-relaxed text-muted-foreground',
        description: 'Texto padrão em parágrafos e descrições.',
    },
    {
        name: 'Body Small',
        className: 'text-sm leading-relaxed text-muted-foreground',
        description: 'Captions, anotações e conteúdo secundário.',
    },
    {
        name: 'Caption',
        className: 'text-xs uppercase tracking-[0.18em] text-muted-foreground',
        description: 'Metadados, carimbos de data e rótulos.',
    },
];
const TypographyScale = ({ sampleText }) => (_jsx("div", { className: "flex w-full max-w-4xl flex-col gap-6", children: TYPOGRAPHY_SCALE.map((item) => (_jsxs("div", { className: "rounded-xl border border-[color:color-mix(in_oklab,var(--color-border)60%,transparent)] bg-[color:color-mix(in_oklab,var(--color-surface-shell)94%,transparent)] p-6 shadow-sm", children: [_jsx("p", { className: "font-mono text-[11px] uppercase tracking-wide text-muted-foreground", children: item.name }), _jsx("p", { className: `${item.className} mt-2 text-foreground`, children: sampleText }), _jsx("p", { className: "mt-3 text-sm text-muted-foreground", children: item.description }), _jsx("code", { className: "mt-3 block text-xs text-muted-foreground", children: item.className })] }, item.name))) }));
export default {
    title: 'Tokens/Tipografia',
    component: TypographyScale,
    argTypes: {
        sampleText: {
            control: 'text',
            name: 'Texto de exemplo',
        },
    },
    args: {
        sampleText: 'Omnichannel que aproxima pessoas.',
    },
};
export const Exibir = {
    args: {
        sampleText: 'Omnichannel que aproxima pessoas.',
    },
};
