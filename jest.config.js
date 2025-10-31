export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  moduleNameMapping: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@/(.*)$': '<rootDir>/client/src/$1'
  },
  testMatch: [
    '<rootDir>/tests/api/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'server/**/*.ts',
    '!server/index.ts',
    '!server/**/*.d.ts'
  ],
  coverageDirectory: 'docs/test_reports/coverage',
  coverageReporters: ['text', 'lcov', 'html']
};