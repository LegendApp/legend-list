import { defineConfig } from 'tsup';

const Exclude = new Set(['.DS_Store']);

const external = ['react', 'react-native'];

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  external,
  dts: true,
  treeshake: true,
  splitting: false,
  clean: true,
});
