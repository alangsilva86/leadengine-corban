import plugin from 'tailwindcss/plugin';
import { surface, foreground, accent, status, tone, spacing, radii, shadows } from './tailwind.tokens.js';
const tokenGroups = {
    surface,
    foreground,
    accent,
    status,
    tone,
};
const cssVarOverrides = {
    'foreground-muted': '--color-foreground-muted',
};
const toCssVar = (token) => cssVarOverrides[token] ?? `--${token}`;
const flattenTokens = Object.values(tokenGroups).reduce((acc, group) => {
    for (const [token, value] of Object.entries(group)) {
        acc[token] = value;
    }
    return acc;
}, {});
const createColorScale = (groupName) => Object.entries(tokenGroups[groupName]).reduce((acc, [token, value]) => {
    if (token === groupName || token.startsWith(`${groupName}-`)) {
        const shade = token === groupName ? 'DEFAULT' : token.slice(groupName.length + 1);
        acc[shade] = `var(${toCssVar(token)}, ${value.default})`;
    }
    return acc;
}, {});
const surfaceColors = createColorScale('surface');
const foregroundColors = createColorScale('foreground');
const accentColors = createColorScale('accent');
const statusColors = createColorScale('status');
const toneColors = createColorScale('tone');
const aliasColors = Object.entries(flattenTokens).reduce((acc, [token, value]) => {
    const isGroupToken = token === 'surface' ||
        token === 'foreground' ||
        token === 'accent' ||
        token === 'status' ||
        token === 'tone' ||
        token.startsWith('surface-') ||
        token.startsWith('foreground-') ||
        token.startsWith('accent-') ||
        token.startsWith('status-') ||
        token.startsWith('tone-');
    if (!isGroupToken) {
        acc[token] = `var(${toCssVar(token)}, ${value.default})`;
    }
    return acc;
}, {});
const semanticColorTokens = Object.entries(flattenTokens).reduce((acc, [token, value]) => {
    acc[token] = `var(${toCssVar(token)}, ${value.default})`;
    return acc;
}, {});
const pascalCase = (value) => value
    .split(/[-_]/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
const semanticUtilitiesPlugin = plugin(({ addUtilities }) => {
    // Utility selectors like `.bgSurfaceShell` or `.textForegroundMuted` are
    // generated from the semantic token names so teams can reference intent
    // without remembering the underlying CSS variable.
    const utilities = Object.entries(semanticColorTokens).reduce((acc, [token, cssVar]) => {
        const tokenName = pascalCase(token);
        acc[`.text${tokenName}`] = { color: cssVar };
        acc[`.border${tokenName}`] = { borderColor: cssVar };
        acc[`.bg${tokenName}`] = { backgroundColor: cssVar };
        acc[`.fill${tokenName}`] = { fill: cssVar };
        acc[`.stroke${tokenName}`] = { stroke: cssVar };
        return acc;
    }, {});
    addUtilities(utilities);
});
const config = {
    content: ['./index.html', './src/**/*.{js,jsx,ts,tsx,md,mdx}'],
    theme: {
        extend: {
            spacing,
            borderRadius: radii,
            boxShadow: shadows,
            colors: {
                ...aliasColors,
                surface: surfaceColors,
                foreground: foregroundColors,
                accent: accentColors,
                status: statusColors,
                tone: toneColors,
            },
        },
    },
    plugins: [semanticUtilitiesPlugin],
};
export default config;
