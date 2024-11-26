import eslint from '@eslint/js';
import tsEslint from 'typescript-eslint';
import pluginPrettier from 'eslint-plugin-prettier/recommended';
import eslintConfigPrettier from 'eslint-config-prettier';
import pluginReact from 'eslint-plugin-react';
import globals from 'globals';

/**
 * @type {import('eslint').Linter.Config}
 */
export default [
  eslint.configs.recommended,
  eslintConfigPrettier,
  pluginPrettier,
  pluginReact.configs.flat.recommended,
  ...tsEslint.configs.strictTypeChecked,
  ...tsEslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: { jsx: true },
      },
      ecmaVersion: 5,
      globals: {
        ...globals.node,
        ...globals.es2025,
      },
      "sourceType": "script",
    },
    rules: {
      'react/jsx-sort-props': 'error',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/function-component-definition': ['error', { namedComponents: 'arrow-function' }],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: false },
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    ignores: [
      'example/**/*',
      'dist',
      'eslint.config.mjs'
    ]
  }
];
