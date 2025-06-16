/* eslint-disable @typescript-eslint/no-require-imports */
const globals = require('globals')
const pluginJs = require('@eslint/js')
const tseslint = require('typescript-eslint')
const tsParser = require('@typescript-eslint/parser')

module.exports = [
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: {
        ...globals.node,
      },

      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },

  {
    rules: {
      '@typescript-eslint/semi': 0,
      'block-spacing': 0,
      'quote-props': 0,
      'max-len': 0,
      '@typescript-eslint/space-before-blocks': 0,
      'arrow-spacing': 0,
      'jsx-quotes': 0,
      'no-console': 0,
      'no-trailing-spaces': 0,
      '@typescript-eslint/no-explicit-any': 0,
      '@typescript-eslint/comma-dangle': 0,
      'import/order': 0,
      'nonblock-statement-body-position': 0,
      '@typescript-eslint/no-empty-function': 0,
      'operator-linebreak': 0,
      'import/prefer-default-export': 0,
      '@typescript-eslint/indent': 0,
      'object-property-newline': 0,
      '@typescript-eslint/quotes': 0,
      '@typescript-eslint/space-infix-ops': 0,
      'no-underscore-dangle': 0,
      'prefer-promise-reject-errors': 0,
      'no-multiple-empty-lines': 0,
      'key-spacing': 0,
      '@typescript-eslint/object-curly-spacing': 0,
      '@typescript-eslint/brace-style': 0,
      'object-curly-newline': 0,
      'no-multi-spaces': 0,
      'curly': [0, 'multi-line'],
      'padded-blocks': 0,
      '@typescript-eslint/naming-convention': 0,
      'prefer-destructuring': 0,
      '@typescript-eslint/ban-ts-comment': 0,
      'no-restricted-syntax': 0,
      'no-prototype-builtins': 0,
      'space-in-parens': 0,

      'no-param-reassign': [
        2,
        {
          props: true,
          ignorePropertyModificationsForRegex: ['^acc', '^draft'],
        },
      ],

      'function-paren-newline': 0,
      'prefer-template': 0,
      'no-nested-ternary': 0,
      'no-use-before-define': 0,

      '@typescript-eslint/no-use-before-define': [
        1,
        {
          typedefs: false,
          functions: false,
          classes: false,
        },
      ],

      'no-empty': [
        1,
        {
          allowEmptyCatch: true,
        },
      ],

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

      '@typescript-eslint/comma-spacing': 0,
      'implicit-arrow-linebreak': 0,
      'eol-last': 0,
      '@typescript-eslint/keyword-spacing': 0,
      '@typescript-eslint/space-before-function-paren': 0,
      'arrow-parens': 0,
      'arrow-body-style': 0,
      'no-spaced-func': 0,
      '@typescript-eslint/func-call-spacing': 0,
      'computed-property-spacing': 0,
      'prefer-arrow-callback': 0,
      'no-whitespace-before-property': 0,
      'no-tabs': 0,
      'no-confusing-arrow': 0,
    },
  },
]
