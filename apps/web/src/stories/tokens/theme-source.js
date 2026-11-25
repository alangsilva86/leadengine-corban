import themeCss from '@/styles/theme.css?raw';

/**
 * As histórias de tokens leem o próprio theme.css (fonte única da paleta), então nunca mostram valores
 * desatualizados. Só é usado no Storybook.
 */

/** Primeiro bloco `seletor { … }` do theme.css como texto. */
const readBlock = (selector) => {
  const start = themeCss.indexOf(`\n${selector} {`);
  if (start < 0) return '';
  const end = themeCss.indexOf('\n}', start);
  return themeCss.slice(start, end < 0 ? undefined : end);
};

const readPalette = (selector) =>
  Object.fromEntries(
    [...readBlock(selector).matchAll(/^\s*--ds-([\w-]+):\s*([^;]+);/gm)].map(([, name, value]) => [name, value.trim()]),
  );

/** Paleta base (`--ds-*`) com os valores do tema claro e do escuro. */
export const PALETTE = { light: readPalette(':root'), dark: readPalette('.dark') };

/** Escala de sombras do Tailwind (`shadow-sm` → `--ds-elev-2`…), lida da camada de compatibilidade. */
export const SHADOW_SCALE = [...themeCss.matchAll(/^\s*--sys-shadow(?:-([\w]+))?:\s*var\(--ds-(elev-\d+)\);/gm)].map(
  ([, size, elevation]) => ({ utility: size ? `shadow-${size}` : 'shadow', variable: size ? `--shadow-${size}` : '--shadow', elevation }),
);
