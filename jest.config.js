/**
 * Los tests cubren el núcleo de negocio (src/core). Next usa módulos ES y `moduleResolution: bundler`;
 * Jest necesita CommonJS, por eso ts-jest lleva su propia configuración de TypeScript.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/core/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2022',
          lib: ['ES2022'],
          module: 'commonjs',
          moduleResolution: 'node',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          types: ['node', 'jest'],
        },
      },
    ],
  },
  collectCoverageFrom: [
    'src/core/**/*.ts',
    '!src/core/__tests__/**',
    '!src/core/**/index.ts',
    '!src/core/infrastructure/github/**', // adaptador de red: se prueba contra GitHub, no con mocks
  ],
  coverageThreshold: {
    global: { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
};
