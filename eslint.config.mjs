import { defineConfig } from 'eslint/config';
import eslintPlugin from '@eslint/js';
import { configs as tseslintConfigs } from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';

// Global ignores
const ignoresConfig = defineConfig([
  {
    name: 'project/ignores',
    ignores: ['.next/', 'node_modules/', 'public/', '.vscode/', 'out/', 'build/'],
  },
]);

// ESLint recommended rules
const eslintConfig = defineConfig([
  {
    name: 'project/javascript-recommended',
    files: ['**/*.{js,mjs,ts,tsx}'],
    ...eslintPlugin.configs.recommended,
  },
]);

// TypeScript configuration
const typescriptConfig = defineConfig([
  {
    name: 'project/typescript',
    files: ['**/*.{ts,tsx}'],
    extends: [
      ...tseslintConfigs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
  {
    name: 'project/javascript-disable-type-check',
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslintConfigs.disableTypeChecked,
  }
]);

// React and Next.js configuration
const reactConfig = defineConfig([
  {
    name: 'project/react-next',
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
      '@next/next': nextPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    name: 'project/react-hooks-ts',
    files: ['**/*.ts'],
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
    },
  },
]);

// Custom rules configuration
const customRulesConfig = defineConfig([
  {
    name: 'project/custom-rules',
    files: ['**/*.{js,mjs,ts,tsx,jsx}'],
    rules: {
      'indent': ['error', 2, {
        'SwitchCase': 1,
        'ignoredNodes': [
          'JSXElement',
          'JSXElement > *',
          'JSXAttribute',
          'JSXExpressionContainer',
          'JSXOpeningElement',
          'JSXClosingElement',
          'JSXText',
          'JSXFragment',
          'JSXOpeningFragment',
          'JSXClosingFragment'
        ]
      }],
      'quotes': ['error', 'single', { 'avoidEscape': true, 'allowTemplateLiterals': true }],
      'object-curly-spacing': ['error', 'always'],
      'max-len': 'off',
      'eol-last': ['error', 'always'],
      'no-multiple-empty-lines': ['error', { 'max': 1, 'maxEOF': 0 }],
      'no-unused-vars': 'off',
    },
  },
  {
    name: 'project/react-jsx-rules',
    files: ['**/*.{jsx,tsx}'],
    rules: {
      'react/jsx-first-prop-new-line': ['error', 'multiline'],
      'react/jsx-max-props-per-line': ['error', { 'maximum': 2 }],
      'react/jsx-indent-props': ['error', 2],
      'react/jsx-closing-bracket-location': ['error', 'tag-aligned'],
      'react/jsx-tag-spacing': ['error', { 'beforeSelfClosing': 'always' }],
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react/no-unknown-property': ['error', { ignore: ['jsx', 'global'] }],
      '@next/next/no-html-link-for-pages': 'warn',
      '@next/next/no-img-element': 'warn',
    },
  },
  {
    name: 'project/next-env-overrides',
    files: ['next-env.d.ts'],
    rules: {},
  },
]);

export default defineConfig([
  ...ignoresConfig,
  ...eslintConfig,
  ...typescriptConfig,
  ...reactConfig,
  ...customRulesConfig,
]);
