/* @lifecycle ACTIVE — Jest config for Telemetry tests (TASK-047) */

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '__tests__/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../guard/tsconfig.json' }],
  },
  testEnvironment: 'node',
  coverageDirectory: '<rootDir>/coverage',
};
