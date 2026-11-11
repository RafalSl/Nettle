const { defineConfig, globalIgnores } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  globalIgnores(['node_modules/', '.expo/', 'dist/']),
  expo,
  {
    // Ports and adapters: core logic makes no platform or network calls and knows no adapters.
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['expo', 'expo-*', 'react-native', 'react', '@react-native*', 'node:*'], message: 'src/core must stay platform-free.' },
            { group: ['@/adapters/*', '@/ui/*', '@/i18n', '@/i18n/*', '@/services'], message: 'src/core must not depend on adapters or UI.' },
          ],
        },
      ],
    },
  },
]);
