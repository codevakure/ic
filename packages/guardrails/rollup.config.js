import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';

const extensions = ['.ts', '.tsx'];

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    {
      file: 'dist/index.es.js',
      format: 'es',
      sourcemap: true,
    },
  ],
  plugins: [
    peerDepsExternal(),
    json(),
    resolve({
      extensions,
      preferBuiltins: true,
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: './dist/types',
      rootDir: './src',
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
    }),
    babel({
      extensions,
      babelHelpers: 'runtime',
      exclude: 'node_modules/**',
      presets: [
        ['@babel/preset-env', { targets: { node: '18' } }],
        '@babel/preset-typescript',
      ],
      plugins: [
        ['@babel/plugin-transform-runtime', { useESModules: false }],
      ],
    }),
  ],
  external: [
    '@aws-sdk/client-bedrock-runtime',
    /@babel\/runtime/,
  ],
};
