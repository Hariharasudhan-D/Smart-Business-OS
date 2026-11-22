// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      // The app uses event-driven effects and runtime enum exports that the newest
      // compiler-oriented lint rules cannot model accurately yet.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react/no-unescaped-entities': 'off',
      'import/namespace': 'off',
    },
  },
]);
