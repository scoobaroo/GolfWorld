const js = require('@eslint/js');
const ts = require('typescript-eslint');
const globals = require('globals');
module.exports = ts.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**', 'https:/**', '**/test-results/**', '**/playwright-report/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
);
