import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: ['**/node_modules/**', '**/.next/**'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
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
      'react/jsx-first-prop-new-line': ['error', 'multiline'],
      'react/jsx-max-props-per-line': ['error', { 'maximum': 2 }],
      'react/jsx-indent-props': ['error', 2],
      'react/jsx-closing-bracket-location': ['error', 'tag-aligned'],
      'react/jsx-tag-spacing': ['error', { 'beforeSelfClosing': 'always' }],
      'object-curly-spacing': ['error', 'always'],
      'max-len': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
      '@next/next/no-img-element': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    }
  },

  // Disable triple-slash reference rule for Next.js auto-generated types file.
  {
    files: ['next-env.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  }
];

export default eslintConfig;
