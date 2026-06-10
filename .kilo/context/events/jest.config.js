/* @lifecycle ACTIVE — Jest config for Event Compression tests (Phase 3) */

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '__tests__/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testEnvironment: 'node',
  coverageDirectory: '<rootDir>/coverage',
};
