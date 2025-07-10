/* eslint-disable max-lines */
/* eslint-disable import/first */
import globals from 'globals';
import { fixupPluginRules } from '@eslint/compat';
import { configs, parser, plugin } from 'typescript-eslint';
import _import from 'eslint-plugin-import';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parser imports
 * The parser is responsible for telling ESLint how to parse the code. This is important for ESLint to
 * understand the code and apply the rules and settings defined in the ESLint configuration.
 */
const tsParser = parser;

/**
 * Plugin imports
 * Plugins are used to define rules and settings for ESLint. These rules are added in the rules object and/or
 * settings object within the ESLint configuration.
 */
const typescriptEslintPlugin = plugin;

/**
 * ESLint core rules
 * These rules are part of the core ESLint package and focus on JavaScript best practices,
 * potential errors, and stylistic preferences.
 */
const eslintRules = {
  /** eslint possible problems*/
  'array-callback-return': 'error',
  'no-constant-binary-expression': 'error',
  'no-constructor-return': 'error',
  'no-new-native-nonconstructor': 'error',
  'no-promise-executor-return': 'error',
  'no-self-compare': 'error',
  'no-template-curly-in-string': 'error',
  'no-unmodified-loop-condition': 'error',
  'no-unreachable-loop': 'error',
  'no-unused-private-class-members': 'error',
  'require-atomic-updates': 'error',
  'block-scoped-var': 'error',
  /** eslint suggestions */
  'arrow-body-style': ['error', 'as-needed'],
  camelcase: ['error'],
  complexity: ['error', 15],
  curly: ['error', 'multi-line'],
  'default-case': 'error',
  'default-case-last': 'error',
  eqeqeq: 'error',
  'func-name-matching': 'error',
  'func-style': ['error', 'expression'],
  'guard-for-in': 'error',
  'logical-assignment-operators': 'error',
  'max-classes-per-file': ['error', 1],
  'max-depth': ['error', 6],
  'max-lines': ['error', 400],
  'max-lines-per-function': [
    'error',
    {
      max: 100,
      skipBlankLines: true,
      skipComments: true,
    },
  ],
  'max-nested-callbacks': ['error', 3],
  'max-params': ['error', 3],
  'max-statements': ['error', 30],
  'new-cap': ['error', { capIsNewExceptions: ['Attribute', 'Table', 'Default', 'HasOne', 'HasMany', 'BelongsTo', 'ENUM'] }],
  'no-alert': 'error',
  'no-bitwise': 'error',
  'no-confusing-arrow': 'error',
  'no-console': 'off',
  'no-else-return': 'error',
  'no-empty': 'error',
  'no-empty-static-block': 'error',
  'no-eq-null': 'error',
  'no-eval': 'error',
  'no-extend-native': 'error',
  'no-fallthrough': 'off', // Turn this off because typescript has a better way to handle this
  'no-extra-bind': 'error',
  'no-extra-label': 'error',
  'no-floating-decimal': 'error',
  'no-implicit-coercion': [
    'error',
    {
      boolean: true,
      number: true,
      string: true,
    },
  ],
  'no-implicit-globals': 'error',
  'no-inline-comments': 'off',
  'no-iterator': 'error',
  'no-labels': 'error',
  'no-lone-blocks': 'error',
  'no-lonely-if': 'error',
  'no-mixed-operators': 'error',
  'no-multi-assign': 'error',
  'no-multi-str': 'error',
  'no-negated-condition': 'error',
  'no-nested-ternary': 'error',
  'no-new': 'error',
  'no-new-func': 'error',
  'no-new-object': 'error',
  'no-new-wrappers': 'error',
  'no-param-reassign': 'error',
  'no-return-assign': ['error', 'except-parens'],
  'no-script-url': 'error',
  'no-unneeded-ternary': 'error',
  'no-useless-call': 'error',
  'no-useless-concat': 'error',
  'no-useless-return': 'error',
  'no-useless-computed-key': 'error',
  'no-useless-rename': 'error',
  'no-var': 'error',
  'no-useless-escape': 'error',
  'object-shorthand': 'error',
  'one-var': ['error', 'never'],
  'operator-assignment': 'error',
  'prefer-arrow-callback': 'error',
  'prefer-const': 'error',
  'prefer-destructuring': 'error',
  'prefer-named-capture-group': 'error',
  'prefer-numeric-literals': 'error',
  'prefer-object-spread': 'error',
  'prefer-promise-reject-errors': 'error',
  'prefer-regex-literals': 'error',
  'prefer-rest-params': 'error',
  'prefer-spread': 'error',
  'prefer-template': 'error',
  radix: 'error',
  'require-unicode-regexp': 'off',
  'sort-imports': [
    'error',
    {
      ignoreDeclarationSort: true,
    },
  ],
  'sort-vars': 'error',
  'spaced-comment': ['error', 'always'],
  'vars-on-top': 'error',
  yoda: [
    'error',
    'never',
    {
      exceptRange: true,
    },
  ],
  /** eslint layout and formatting */
  'array-bracket-spacing': ['error', 'never'],
  'comma-dangle': ['error', 'always-multiline'],
  'comma-spacing': [
    'error',
    {
      before: false,
      after: true,
    },
  ],
  'semi-spacing': [
    'error',
    {
      before: false,
      after: true,
    },
  ],
  'space-before-blocks': ['error', 'always'],
  'space-before-function-paren': [
    'error',
    {
      anonymous: 'always',
      named: 'never',
      asyncArrow: 'always',
    },
  ],
  'space-infix-ops': 'error',
  'space-unary-ops': [
    'error',
    {
      words: true,
      nonwords: false,
    },
  ],
  'template-curly-spacing': ['error', 'never'],
  'wrap-regex': 'off',
};

/**
 * Import plugin rules
 * These rules help enforce best practices for ES module imports
 */
const importRules = {
  'import/export': 'error',
  'import/no-deprecated': 'error',
  'import/no-empty-named-blocks': 'error',
  'import/no-mutable-exports': 'error',
  'import/no-named-as-default-member': 'error',
  'import/no-unused-modules': 'error',
  'import/no-amd': 'error',
  'import/no-commonjs': 'error',
  'import/default': 'error',
  'import/named': 'error',
  'import/namespace': 'error',
  'import/no-absolute-path': 'error',
  'import/no-dynamic-require': 'error',
  'import/no-unresolved': 'off',
  'import/no-useless-path-segments': 'error',
  'import/consistent-type-specifier-style': 'error',
  'import/extensions': [
    'error',
    'always',
    {
      ignorePackages: true,
    },
  ],
  'import/first': 'error',
  'import/group-exports': 'off',
  'import/newline-after-import': 'error',
  'import/no-duplicates': 'error',
  'import/order': 'error',
};

/**
 * TypeScript-specific rules
 * These rules leverage TypeScript's type system to catch errors and enforce best practices
 */
const typscriptRules = {
  '@typescript-eslint/adjacent-overload-signatures': 'error',
  '@typescript-eslint/array-type': [
    'error',
    {
      default: 'generic',
    },
  ],
  '@typescript-eslint/await-thenable': 'error',
  // '@typescript-eslint/ban-types': 'error',
  '@typescript-eslint/class-literal-property-style': 'error',
  '@typescript-eslint/consistent-generic-constructors': 'error',
  '@typescript-eslint/consistent-indexed-object-style': ['error', 'record'],
  '@typescript-eslint/consistent-type-assertions': [
    'error',
    {
      assertionStyle: 'as',
    },
  ],
  '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
  '@typescript-eslint/consistent-type-exports': [
    'error',
    {
      fixMixedExportsWithInlineTypeSpecifier: true,
    },
  ],
  '@typescript-eslint/explicit-function-return-type': 'error',
  '@typescript-eslint/explicit-member-accessibility': [
    'error',
    {
      accessibility: 'no-public',
    },
  ],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    {
      prefer: 'type-imports',
      disallowTypeAnnotations: true,
      fixStyle: 'separate-type-imports',
    },
  ],
  '@typescript-eslint/explicit-module-boundary-types': 'error',
  '@typescript-eslint/method-signature-style': ['error', 'property'],
  '@typescript-eslint/naming-convention': [
    'error',
    {
      selector: ['variable'],
      format: ['camelCase', 'StrictPascalCase', 'UPPER_CASE'],
      leadingUnderscore: 'allow',
    },
    {
      selector: ['parameter', 'typeProperty'],
      format: ['camelCase', 'StrictPascalCase'],
      leadingUnderscore: 'allow',
    },
    {
      selector: ['enumMember'],
      format: ['UPPER_CASE'],
    },
    {
      selector: ['interface', 'typeParameter', 'enum'],
      format: ['PascalCase'],
    },
  ],
  '@typescript-eslint/no-base-to-string': 'error',
  '@typescript-eslint/no-confusing-non-null-assertion': 'error',
  '@typescript-eslint/no-confusing-void-expression': [
    'error',
    {
      ignoreArrowShorthand: true,
      ignoreVoidOperator: true,
    },
  ],
  '@typescript-eslint/no-duplicate-enum-values': 'error',
  '@typescript-eslint/no-duplicate-type-constituents': 'error',
  '@typescript-eslint/no-dynamic-delete': 'off',
  '@typescript-eslint/no-empty-interface': 'error',
  '@typescript-eslint/no-explicit-any': [
    'off',
    {
      ignoreRestArgs: true,
      fixToUnknown: true,
    },
  ],
  '@typescript-eslint/no-extra-non-null-assertion': 'error',
  '@typescript-eslint/no-extraneous-class': 'error',
  '@typescript-eslint/no-floating-promises': [
    'error',
    {
      ignoreVoid: false,
    },
  ],
  '@typescript-eslint/no-for-in-array': 'error',
  '@typescript-eslint/no-import-type-side-effects': 'error',
  '@typescript-eslint/no-inferrable-types': 'error',
  '@typescript-eslint/no-invalid-void-type': [
    'off',
    {
      allowAsThisParameter: true,
      allowInGenericTypeArguments: true,
    },
  ],
  '@typescript-eslint/no-misused-new': 'error',
  '@typescript-eslint/no-misused-promises': 'error',
  '@typescript-eslint/no-mixed-enums': 'error',
  '@typescript-eslint/no-namespace': 'error',
  '@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'error',
  '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/no-require-imports': 'error',
  '@typescript-eslint/no-this-alias': 'error',
  '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
  '@typescript-eslint/no-unnecessary-condition': [
    'error',
    {
      allowConstantLoopConditions: true,
    },
  ],
  '@typescript-eslint/no-unnecessary-qualifier': 'error',
  '@typescript-eslint/no-unnecessary-type-arguments': 'error',
  '@typescript-eslint/no-unnecessary-type-assertion': 'error',
  '@typescript-eslint/no-unnecessary-type-constraint': 'error',
  '@typescript-eslint/no-unsafe-argument': 'warn',
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-enum-comparison': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
  '@typescript-eslint/no-useless-empty-export': 'error',
  '@typescript-eslint/no-var-requires': 'error',
  '@typescript-eslint/non-nullable-type-assertion-style': 'error',
  '@typescript-eslint/prefer-enum-initializers': 'error',
  '@typescript-eslint/prefer-for-of': 'error',
  '@typescript-eslint/prefer-function-type': 'error',
  '@typescript-eslint/prefer-includes': 'error',
  '@typescript-eslint/prefer-literal-enum-member': 'error',
  '@typescript-eslint/prefer-namespace-keyword': 'error',
  '@typescript-eslint/prefer-nullish-coalescing': ['error'],
  '@typescript-eslint/prefer-readonly': 'error',
  '@typescript-eslint/prefer-reduce-type-parameter': 'error',
  '@typescript-eslint/prefer-regexp-exec': 'error',
  '@typescript-eslint/prefer-string-starts-ends-with': 'error',
  '@typescript-eslint/prefer-ts-expect-error': 'error',
  '@typescript-eslint/promise-function-async': 'error',
  '@typescript-eslint/require-array-sort-compare': 'error',
  '@typescript-eslint/restrict-plus-operands': 'error',
  '@typescript-eslint/restrict-template-expressions': 'error',
  '@typescript-eslint/sort-type-constituents': 'error',
  '@typescript-eslint/switch-exhaustiveness-check': 'error',
  '@typescript-eslint/unified-signatures': 'error',
  /** typescript extension rules */
  'default-param-last': 'off',
  '@typescript-eslint/default-param-last': 'error',
  'dot-notation': 'off',
  '@typescript-eslint/dot-notation': 'error',
  'init-declarations': 'off',
  '@typescript-eslint/init-declarations': 'error',
  'no-array-constructor': 'off',
  '@typescript-eslint/no-array-constructor': 'error',
  'no-dupe-class-members': 'off',
  '@typescript-eslint/no-dupe-class-members': 'error',
  'no-empty-function': 'off',
  '@typescript-eslint/no-empty-function': 'error',
  'no-extra-semi': 'off',
  // '@typescript-eslint/no-extra-semi': 'error',
  'no-implied-eval': 'off',
  '@typescript-eslint/no-implied-eval': 'error',
  'no-invalid-this': 'off',
  '@typescript-eslint/no-invalid-this': 'error',
  'no-loop-func': 'off',
  '@typescript-eslint/no-loop-func': 'error',
  'no-loss-of-precision': 'off',
  '@typescript-eslint/no-loss-of-precision': 'error',
  'no-magic-numbers': 'off',
  'no-redeclare': 'off',
  '@typescript-eslint/no-redeclare': 'error',
  'no-restricted-imports': 'off',
  '@typescript-eslint/no-restricted-imports': 'error',
  'no-shadow': 'off',
  '@typescript-eslint/no-shadow': 'error',
  'no-throw-literal': 'off',
  // '@typescript-eslint/no-throw-literal': 'error',
  'no-unused-expressions': 'off',
  '@typescript-eslint/no-unused-expressions': 'error',
  'no-unused-vars': 'off',
  'no-underscore-dangle': 'off', // Turn this off because we use typscript/no-unused-vars
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    },
  ],
  '@typescript-eslint/no-use-before-define': 'off',
  'no-useless-constructor': 'off',
  '@typescript-eslint/no-useless-constructor': 'error',
  'no-return-await': 'off',
  '@typescript-eslint/return-await': 'error',

  /**
   * require-await is turned off so it doesn't conflict with the @typescript-eslint/require-await rule
   */
  'require-await': 'off',
  '@typescript-eslint/require-await': 'error',
};

/**
 * Test-specific rules
 * These rules are relaxed for test files to accommodate common testing patterns
 */
const testRules = {
  // Allow empty arrow functions in mocks
  'no-empty-function': 'off',
  '@typescript-eslint/no-empty-function': 'off',
  'arrow-body-style': 'off',

  // Allow unused parameters in mock functions - prefix with _ or allow any parameter name
  '@typescript-eslint/no-unused-vars': 'off',

  // Allow any type in test assertions
  '@typescript-eslint/no-unsafe-return': 'off',
  '@typescript-eslint/no-explicit-any': 'off',

  // Allow longer functions in tests
  'max-lines-per-function': 'off',

  // Allow more lines in test files
  'max-lines': 'off',

  // Allow more statements in test functions
  'max-statements': 'off',

  // Allow more parameters in test functions
  'max-params': 'off',

  // Allow more nested functions in test files
  'max-nested-callbacks': 'off',

  // Allow type assertions in tests
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-unsafe-call': 'off',
  '@typescript-eslint/no-unsafe-argument': 'off',
  '@typescript-eslint/unbound-method': 'off',

  // Allow variable initialization in beforeEach
  '@typescript-eslint/init-declarations': 'off',

  // Allow type assertions with 'as'
  '@typescript-eslint/consistent-type-assertions': 'off',

  // Allow promise executor returns in tests
  'no-promise-executor-return': 'off',

  // Allow awaiting non-promises in tests
  '@typescript-eslint/await-thenable': 'off',

  // Allow void expressions in tests
  '@typescript-eslint/no-confusing-void-expression': 'off',

  // Allow no return type in tests
  '@typescript-eslint/explicit-function-return-type': 'off',
};

// Include TypeScript ESLint configs directly
const strictConfig = configs.strict;
const stylisticConfig = configs.stylistic;

// Export as a flat config array
export default [
  // Global ignores - files that should be excluded from linting
  {
    ignores: ['node_modules/*', 'lib/*', '**/*.js', 'example/**/*', 'eslint.config.mjs'],
  },

  // Include TypeScript ESLint configs directly
  ...strictConfig,
  ...stylisticConfig,

  // Base configuration for all files
  {
    name: 'yinzerflow/base',
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {},
      },
      'import/ignore': ['node_modules'],
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2025,
        Bun: false,
      },
      parser: tsParser,
      parserOptions: {
        // Using projectService for better performance with TypeScript's type checking
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      import: fixupPluginRules(_import),
      '@typescript-eslint': typescriptEslintPlugin,
    },
    rules: {
      ...eslintRules,
      ...importRules,
      ...typscriptRules,
    },
  },

  // Test files configuration - separate config object with files pattern
  {
    name: 'yinzerflow/tests',
    files: ['**/__tests__/**/*.ts', '**/*.spec.ts', '**/*.test.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2025,
        Bun: true,
      },
    },
    rules: testRules,
  },
];
