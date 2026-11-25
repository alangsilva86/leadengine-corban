import { PALETTE, SHADOW_SCALE } from './theme-source.js';

const ShadowGrid = () => (
  <div className="grid w-full max-w-4xl gap-6 sm:grid-cols-2">
    {SHADOW_SCALE.map(({ utility, variable, elevation }) => (
      <div key={utility} className="rounded-lg border border-border bg-background p-6">
        <div
          className="flex h-28 items-center justify-center rounded-lg bg-surface text-sm text-muted-foreground"
          style={{ boxShadow: `var(${variable})` }}
        >
          {utility}
        </div>
        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
          <div className="font-mono text-[11px] text-foreground">
            {utility} → --ds-{elevation}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between gap-2"><span>Claro</span><code className="break-words text-right">{PALETTE.light[elevation] ?? '—'}</code></div>
            <div className="flex justify-between gap-2"><span>Escuro</span><code className="break-words text-right">{PALETTE.dark[elevation] ?? '—'}</code></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default {
  title: 'Tokens/Sombras',
  component: ShadowGrid,
  parameters: {
    docs: { description: { component: 'Escala `shadow-*` do Tailwind mapeada para `--ds-elev-*` em `src/styles/theme.css`.' } },
  },
};

export const Exibir = {};
