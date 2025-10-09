import { useMemo } from 'react';

import { accent, foreground, status, surface } from '../../../tailwind.tokens.js';

const COLOR_GROUPS = {
  surface: { label: 'Superfícies', tokens: surface },
  foreground: { label: 'Conteúdo', tokens: foreground },
  accent: { label: 'Marca e acentos', tokens: accent },
  status: { label: 'Status e feedback', tokens: status },
};

const CSS_VAR_OVERRIDES = {
  'foreground-muted': '--color-foreground-muted',
};

const toCssVarName = (token) => CSS_VAR_OVERRIDES[token] ?? `--${token.replaceAll('.', '-')}`;

const TokenSwatch = ({ name, value, group }) => {
  const cssVar = toCssVarName(name);
  const isForegroundToken = group === 'foreground' || name.includes('foreground');
  const previewStyle = isForegroundToken
    ? {
        color: `var(${cssVar}, ${value.default})`,
        backgroundColor: 'var(--surface-shell, #f8fafc)',
        borderColor: 'var(--color-border, rgba(15, 23, 42, 0.12))',
      }
    : {
        backgroundColor: `var(${cssVar}, ${value.default})`,
        color: 'rgba(15, 23, 42, 0.92)',
        borderColor: 'color-mix(in oklab, var(--color-border) 65%, transparent)',
      };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-[color:color-mix(in_oklab,var(--color-surface-shell)94%,transparent)] shadow-sm">
      <div
        className="flex h-20 items-center justify-center border-b text-xs font-medium"
        style={previewStyle}
      >
        {isForegroundToken ? 'Texto de exemplo' : name}
      </div>
      <div className="space-y-2 px-4 py-3 text-xs text-muted-foreground">
        <div className="font-mono text-[11px] uppercase tracking-wide text-foreground">{name}</div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between gap-2"><span>Claro</span><code>{value.default}</code></div>
          <div className="flex justify-between gap-2"><span>Escuro</span><code>{value.dark}</code></div>
        </div>
      </div>
    </div>
  );
};

const ColorTokenGrid = ({ group }) => {
  const tokens = useMemo(() => Object.entries(COLOR_GROUPS[group]?.tokens ?? {}), [group]);

  return (
    <div className="grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tokens.map(([name, value]) => (
        <TokenSwatch key={name} name={name} value={value} group={group} />
      ))}
    </div>
  );
};

export default {
  title: 'Tokens/Cores',
  component: ColorTokenGrid,
  argTypes: {
    group: {
      name: 'Grupo',
      options: Object.keys(COLOR_GROUPS),
      control: { type: 'radio' },
      mapping: COLOR_GROUPS,
      labels: Object.fromEntries(
        Object.entries(COLOR_GROUPS).map(([key, value]) => [key, value.label]),
      ),
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
