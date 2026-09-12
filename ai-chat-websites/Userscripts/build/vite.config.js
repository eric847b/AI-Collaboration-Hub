/**
 * Vite build config — Q2 2027 #13 (Build tool integration: Vite/Rollup for
 * development + ES6 module migration). Bundles Userscripts/v3 into an ES
 * module and an IIFE global build.
 *
 *   npm install            (inside Userscripts/build)
 *   npm run build          -> Userscripts/build/dist/unified-suite-v3.{mjs,js}
 */

import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here('../'),
  build: {
    outDir: 'Userscripts/build/dist',
    emptyOutDir: true,
    lib: {
      entry: here('../v3/index.js'),
      name: 'UnifiedSuiteV3',
      formats: ['es', 'iife'],
      fileName: (format) => format === 'es' ? 'unified-suite-v3.mjs' : 'unified-suite-v3.js'
    }
  }
});