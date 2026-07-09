module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-native-community|@testing-library)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/example/', '/dist/'],
  testMatch: ['<rootDir>/__tests__/**/*.test.(ts|tsx|js|jsx)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  moduleFileExtensions: [
    'native.ts',
    'native.tsx',
    'native.js',
    'native.jsx',
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node',
  ],
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx)$': ['@babel/preset-typescript', { preset: 'react-native' }],
  },
};
