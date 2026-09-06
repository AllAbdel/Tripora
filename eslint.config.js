import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * Configuration unique pour tout le dépôt.
 * On reste proche des recommandations officielles : les règles maison ne se
 * justifient que si elles évitent un vrai défaut, pas pour imposer un style.
 */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/*.d.ts', 'supabase/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    // Scripts d'outillage : Node pur, hors du typage strict de l'application.
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { ecmaVersion: 2023, globals: globals.node },
  },

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Les valeurs venues du réseau sont typées par Zod, pas par des `as`.
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'apps/web/scripts/**'],
    rules: {
      'no-console': 'off',
      // `importOriginal<typeof import('…')>()` est la forme imposée par
      // Vitest pour typer un module partiellement simulé. La règle vise le
      // style du code source, pas cette contrainte d'API.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
);
