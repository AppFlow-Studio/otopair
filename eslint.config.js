// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Haptics policy (docs/notifications/PLAN.md §B.4):
    // `expo-haptics` may only be imported by lib/haptics.ts. Every other
    // file routes through the named helpers in `@/lib/haptics`.
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['lib/haptics.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'expo-haptics',
              message:
                'Import named helpers from "@/lib/haptics" instead (e.g. haptics.cta(), haptics.success()). Add a new helper there if a new intent is needed.',
            },
          ],
        },
      ],
    },
  },
]);
