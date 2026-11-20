import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'

import tsParser from '@typescript-eslint/parser'

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: {
      globals: globals.node,
      parser: tsParser,
      ecmaVersion: 'latest',
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        projectService: {
          allowDefaultProject: ['*.js', '*.mjs', '*.cjs'],
        },
      },
    },
  },
  tseslint.configs.recommended,
  {
    rules: {
      'no-unused-vars': 0,
      '@typescript-eslint/no-unused-vars': [
        1,
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_.*',
          varsIgnorePattern: '^_.*',
          destructuredArrayIgnorePattern: '^_.*',

          caughtErrors: 'none',
        },
      ],
      '@typescript-eslint/no-explicit-any': 0,
      '@typescript-eslint/no-unused-expressions': 0,
      '@typescript-eslint/no-non-null-asserted-optional-chain': 0,
      '@typescript-eslint/ban-ts-comment': 0,
      'prefer-const': [1, { destructuring: 'all' }],
      'no-unsafe-optional-chaining': 0,
      'no-prototype-builtins': 0,
      '@typescript-eslint/no-namespace': 0,
      '@typescript-eslint/no-require-imports': 1,
    },
  },
])
