import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  plugins: [
    // Generate TypeScript declarations
    dts({
      insertTypesEntry: true,
      outDir: 'dist/types',
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**'],
      // Skip type checking to avoid errors, just emit declarations
      skipDiagnostics: true,
      compilerOptions: {
        declarationMap: false,
      },
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'DocViewer',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'es.js' : 'cjs'}`,
    },
    rollupOptions: {
      external: (id) => {
        // External dependencies
        const externals = [
          'react',
          'react-dom',
          'react/jsx-runtime',
          'echarts',
          'pdfjs-dist',
          'pptx-preview',
          'fflate',
          'numfmt',
          'papaparse',
          'zrender'
        ];
        
        // Check if id matches any external or contains zrender
        const isExternal = externals.includes(id) || id.includes('zrender');
        
        return isExternal;
      },
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          echarts: 'echarts',
          'pdfjs-dist': 'pdfjsLib',
          'pptx-preview': 'pptxPreview',
          fflate: 'fflate',
          numfmt: 'numfmt',
          papaparse: 'Papa',
          zrender: 'zrender'
        },
        // Properly name CSS assets
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css' || assetInfo.name?.endsWith('.css')) {
            return 'viewer.css';
          }
          return assetInfo.name || 'asset';
        },
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2020',
  },
  optimizeDeps: {
    include: ['fflate', 'pdfjs-dist', 'pptx-preview', 'numfmt', 'papaparse'],
  },
});
