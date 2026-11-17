import js from '@eslint/js';
import html from 'eslint-plugin-html';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['**/*.html'],
    plugins: { html },
    languageOptions: { sourceType: 'module', globals: globals.browser },
    settings: { 'html/javascript-mime-types': ['module', 'text/javascript'] },
  },
);