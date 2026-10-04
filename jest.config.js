// Component tests (React Native Testing Library on jest-expo). Pure logic is tested separately in scripts/*.test.ts.
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/__tests__/**/*.test.tsx'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: { '\.mjs$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'json'],
  moduleNameMapper: { '\.glb$': '<rootDir>/__tests__/fileMock.js', '^@shared/(.*)$': '<rootDir>/shared/$1' },
  transformIgnorePatterns: ['node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@shopify/flash-list|zustand))'],
};
