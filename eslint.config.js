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

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/storybook-static/**',
      '**/node_modules/**',
    ],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
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
)
