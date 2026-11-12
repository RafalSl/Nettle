/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Core and adapter tests need no React Native runtime, so run them in plain Node.
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.ts', '<rootDir>/src/**/*.test.ts'],
  // @noble/* packages are ESM-only; let babel transform them like the Expo packages.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@noble))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
