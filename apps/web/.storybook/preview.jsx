import { withThemeByClassName } from '@storybook/addon-themes';
import { Fragment } from 'react';

import '../src/index.css';
import ThemeProvider from '../src/components/theme/theme-provider.jsx';

const preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    backgrounds: {
      default: 'Surface',
      values: [
        { name: 'Surface', value: 'var(--surface-canvas)' },
        { name: 'Shell', value: 'var(--color-surface-shell)' },
      ],
    },
    layout: 'centered',
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Alternar entre temas claro e escuro',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Claro' },
          { value: 'dark', icon: 'moon', title: 'Escuro' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    withThemeByClassName({
      themes: {
        light: 'light',
        dark: 'dark',
      },
      defaultTheme: 'light',
      parentSelector: 'body',
    }),
    (Story, context) => (
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        disableTransitionOnChange
        forcedTheme={context.globals.theme ?? 'light'}
      >
        <Fragment>
          <div className="min-h-screen w-full bg-[var(--surface-canvas)] p-6 text-[var(--color-foreground)]">
            <Story />
          </div>
        </Fragment>
      </ThemeProvider>
    ),
  ],
};

export default preview;
