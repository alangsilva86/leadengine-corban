import { shadows } from '../../../tailwind.tokens.js';

const ShadowGrid = () => (
  <div className="grid w-full max-w-4xl gap-6 sm:grid-cols-2">
    {Object.entries(shadows).map(([name, value]) => (
      <div
        key={name}
        className="rounded-2xl border border-[color:color-mix(in_oklab,var(--color-border)55%,transparent)] bg-[color:color-mix(in_oklab,var(--color-surface-shell)96%,transparent)] p-6"
      >
        <div
          className="flex h-28 items-center justify-center rounded-xl bg-surface-shell text-sm text-muted-foreground"
          style={{ boxShadow: `var(--shadow-${name}, ${value})` }}
        >
          {name.toUpperCase()}
        </div>
        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
          <div className="font-mono text-[11px] uppercase tracking-wide text-foreground">shadow-{name}</div>
          <code className="block break-words text-[11px] leading-relaxed">{value}</code>
        </div>
      </div>
    ))}
  </div>
);

export default {
  title: 'Tokens/Sombras',
  component: ShadowGrid,
};

export const Exibir = {};
