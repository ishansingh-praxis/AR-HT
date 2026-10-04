const expo = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = [
  ...expo,
  prettier,
  { ignores: ['node_modules/', 'reference/', 'server/', 'scripts/', 'android/', 'ios/', 'dist/', '.expo/'] },
  {
    rules: {
      'no-restricted-imports': ['error', { paths: [{ name: '@reactvision/react-viro', message: 'Import Viro only inside src/ar/.' }] }],
    },
  },
  {
    // React Compiler lint rules flag event-handler Date.now() and Viro's imperative bridge; behaviour is intended, so warn only.
    rules: {
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  { files: ['src/ar/**'], rules: { 'no-restricted-imports': 'off' } },
];
