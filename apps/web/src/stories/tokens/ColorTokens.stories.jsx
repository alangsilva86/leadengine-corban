import { useMemo } from 'react';

import { PALETTE } from './theme-source.js';

const COLOR_GROUPS = {
  surface: { label: 'Superfícies e bordas', match: (name) => /^(background|surface|border|input|ring)/.test(name) },
  content: { label: 'Conteúdo', match: (name) => /^(foreground|muted-foreground|subtle-foreground)$/.test(name) },
  brand: { label: 'Marca', match: (name) => name.startsWith('primary') },
  status: { label: 'Status e feedback', match: (name) => /^(success|warning|danger|info|whatsapp)/.test(name) },
  chat: { label: 'Conversa', match: (name) => name.startsWith('bubble') },
  chart: { label: 'Gráficos', match: (name) => name.startsWith('chart') },
};

const isTextToken = (name) => name === 'foreground' || name.endsWith('-foreground');

/** Texto aparece sobre o fundo com que foi pensado (`warning-foreground` sobre `warning`); os neutros, sobre `surface`. */
const pairedBackground = (name) => {
  const base = name.replace(/-foreground$/, '');
  return base !== name && base in PALETTE.light ? `var(--ds-${base})` : 'var(--ds-surface)';
};

const TokenSwatch = ({ name }) => {
  const cssVar = `--ds-${name}`;
  const previewStyle = isTextToken(name)
    ? { color: `var(${cssVar})`, backgroundColor: pairedBackground(name) }
    : { backgroundColor: `var(${cssVar})` };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex h-20 items-center justify-center border-b border-border text-xs font-medium" style={previewStyle}>
        {isTextToken(name) ? 'Texto de exemplo' : null}
      </div>
      <div className="space-y-2 px-4 py-3 text-xs text-muted-foreground">
        <div className="font-mono text-[11px] text-foreground">{cssVar}</div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between gap-2"><span>Claro</span><code>{PALETTE.light[name] ?? '—'}</code></div>
          <div className="flex justify-between gap-2"><span>Escuro</span><code>{PALETTE.dark[name] ?? '—'}</code></div>
        </div>
      </div>
    </div>
  );
};

const ColorTokenGrid = ({ group }) => {
  const names = useMemo(
    () => Object.keys(PALETTE.light).filter((name) => COLOR_GROUPS[group]?.match(name)),
    [group],
  );

  return (
    <div className="grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {names.map((name) => (
        <TokenSwatch key={name} name={name} />
      ))}
    </div>
  );
};

export default {
  title: 'Tokens/Cores',
  component: ColorTokenGrid,
  parameters: {
    docs: { description: { component: 'Paleta base (`--ds-*`) lida de `src/styles/theme.css`; as amostras usam as variáveis reais.' } },
  },
  argTypes: {
    group: {
      name: 'Grupo',
      options: Object.keys(COLOR_GROUPS),
      control: { type: 'radio', labels: Object.fromEntries(Object.entries(COLOR_GROUPS).map(([key, value]) => [key, value.label])) },
    },
  },
  args: {
    group: 'surface',
  },
};

export const Exibir = {
  args: {
    group: 'surface',
  },
};
