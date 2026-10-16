// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angularPlugin from '@angular-eslint/eslint-plugin';
import angularTemplatePlugin from '@angular-eslint/eslint-plugin-template';
import angularTemplateParser from '@angular-eslint/template-parser';
import importPlugin from 'eslint-plugin-import';

/**
 * Architecture boundaries (docs/ARCHITECTURE.md) are enforced via
 * import/no-restricted-paths with resolved paths (relative AND dynamic
 * imports). When you add a new feature folder, add one zone entry so the
 * feature cannot be imported by sibling features.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.angular/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  eslint.configs.recommended,
  // Type-aware linting for the Angular sources only (templates are parsed by
  // the Angular template parser; e2e/tooling files are linted untyped below).
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['src/**/*.ts'],
  })),
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
  })),

  {
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
  },

  {
    // Node maintenance scripts (repo tooling, not app code).
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
      },
    },
  },

  {
    files: ['**/*.html'],
    plugins: {
      '@angular-eslint/template': angularTemplatePlugin,
    },
    languageOptions: {
      parser: angularTemplateParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    rules: {
      ...angularTemplatePlugin.configs.recommended.rules,
      '@angular-eslint/template/alt-text': 'error',
      '@angular-eslint/template/no-any': 'warn',
    },
  },

  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import/resolver': {
        node: { extensions: ['.ts', '.js', '.json'] },
      },
    },
    plugins: {
      '@angular-eslint': angularPlugin,
      import: importPlugin,
    },
    rules: {
      ...angularPlugin.configs.recommended.rules,
      '@angular-eslint/component-class-suffix': 'error',
      '@angular-eslint/directive-class-suffix': 'error',
      '@angular-eslint/prefer-standalone': 'error',
      '@typescript-eslint/unbound-method': ['error', { ignoreStatic: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          basePath: './src/app',
          zones: [
            // shared is business-agnostic: no app layers allowed
            {
              target: './shared',
              from: './core',
              message: 'shared must not import core (use a port/token defined in shared)',
            },
            { target: './shared', from: './features', message: 'shared must not import features' },
            { target: './shared', from: './shell', message: 'shared must not import shell' },
            // core is the platform: it may use shared, never features/shell
            {
              target: './core',
              from: './features',
              message: 'core must not import features; features implement core ports',
            },
            { target: './core', from: './shell', message: 'core must not import shell' },
            // shell is composition of layout: no feature internals
            {
              target: './shell',
              from: './features',
              message: 'shell must not import feature internals',
            },
            // features never reach into shell or each other
            { target: './features', from: './shell', message: 'features must not import shell' },
            {
              target: './features/auth',
              from: './features',
              except: ['./auth'],
              message: 'cross-feature import: expose a contract instead',
            },
            {
              target: './features/customers',
              from: './features',
              except: ['./customers'],
              message: 'cross-feature import: expose a contract instead',
            },
            {
              target: './features/identity',
              from: './features',
              except: ['./identity'],
              message: 'cross-feature import: expose a contract instead',
            },
          ],
        },
      ],
    },
  },

  {
    // Root composition component keeps the Angular CLI name.
    files: ['src/app/app.ts'],
    rules: {
      '@angular-eslint/component-class-suffix': 'off',
    },
  },

  {
    files: ['src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
);
