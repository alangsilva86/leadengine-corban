import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import noForbiddenTailwindColorsRule from './eslint-rules/no-forbidden-tailwind-colors.cjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const forbiddenTailwindAllowlist = path.resolve(__dirname, 'config/forbidden-tailwind-exceptions.json')

const tailwindPlugin = {
  rules: {
    'no-forbidden-tailwind-colors': noForbiddenTailwindColorsRule,
  },
}

const baseConfig = tseslint.config(
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mts,mjs,cjs,cts}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'no-forbidden-tailwind-colors': tailwindPlugin,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',
      'react-refresh/only-export-components': 'off',
      'no-forbidden-tailwind-colors/no-forbidden-tailwind-colors': [
        'error',
        {
          allowlistPath: forbiddenTailwindAllowlist,
          baseDir: '.',
        },
      ],
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'prefer-const': 'off',
      'no-useless-escape': 'off',
    },
  },
  {
    files: ['packages/*/src/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['**/packages/*/src/**'],
        },
      ],
    },
  },
  {
    files: ['eslint-rules/**/*.{js,cjs}'],
    languageOptions: {
      sourceType: 'commonjs',
    },
    rules: {
      'no-forbidden-tailwind-colors/no-forbidden-tailwind-colors': 'off',
    },
  },
  {
    files: ['**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.{jsx,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    files: ['**/__tests__/**/*.{js,jsx,ts,tsx}', '**/*.{test,spec}.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
      parserOptions: {
        projectService: false,
      },
    },
  },
  {
    files: ['**/*.d.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
  },
  {
    // Arquivos de ferramenta (configs de build/teste, scripts, seed, bootstrap de testes)
    // não pertencem a nenhum tsconfig de pacote, então o project service não os encontra.
    // As regras ativas (recommended + stylistic) não dependem de tipos; aqui só desligamos
    // a análise tipada para esses arquivos, sem desligar nenhuma regra.
    name: 'repo/tooling-files',
    files: [
      '**/*.config.{ts,mts,cts}',
      'scripts/**/*.{ts,mts,cts}',
      'config/**/*.{ts,mts,cts}',
      'apps/*/test/**/*.{ts,mts,cts}',
      'packages/*/prisma/**/*.{ts,mts,cts}',
    ],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
  },
)

export default [
  {
    // Ignorados globais: este objeto precisa conter SOMENTE `ignores` (e `name`).
    // Com qualquer outra chave o ESLint trata `ignores` como filtro local do objeto,
    // e as saídas de build (packages/*/dist, apps/web/.tsbuild) voltam a ser analisadas.
    name: 'repo/global-ignores',
    ignores: [
      // Dependências e saídas de build/ferramentas (também presentes só localmente).
      '**/node_modules/**',
      '.pnpm-store/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.tsbuild/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/.vite/**',
      '**/storybook-static/**',
      '**/test-results/**',
      '**/playwright-report/**',
      // Cópias de conflito do iCloud Drive ("arquivo 2.ts", "pasta 2/").
      '**/* [0-9]/**',
      '**/* [0-9].*',
      // Código gerado (ex.: openapi-typescript): regenere em vez de editar à mão.
      '**/*.gen.ts',
      '**/apps/api/src/features/whatsapp-inbound/routes/__tests__/**',
      '**/apps/api/src/routes/webhooks.test.ts',
      '**/apps/web/src/features/chat/api/useUpdateNextStep.d.ts',
      '**/config/feature-flags.d.ts',
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  ...baseConfig,
]
