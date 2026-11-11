/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Core and adapter tests need no React Native runtime, so run them in plain Node.
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.ts', '<rootDir>/src/**/*.test.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
