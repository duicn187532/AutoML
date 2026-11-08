import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'legacy', 'node_modules', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.worker } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // User-facing strings must go through React (auto-escaped) or core/security/escape.
      'no-restricted-properties': ['error',
        { property: 'innerHTML', message: 'Use React or escapeHtml() — never assign raw HTML.' },
        { property: 'outerHTML', message: 'Use React or escapeHtml() — never assign raw HTML.' }],
      'no-restricted-syntax': ['error', { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'Not allowed: escape user strings.' }],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'vite.config.ts', 'build/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
