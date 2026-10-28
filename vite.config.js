import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import autoprefixer from 'autoprefixer';

// Development: builds unminified to ../origo/plugins (like barebone-plugin does with webpack-dev).
// Production: builds minified to build/js and build/css.
export default defineConfig(({ mode }) => {
  const dev = mode === 'development';

  return {
    css: {
      postcss: {
        plugins: [autoprefixer()]
      }
    },
    build: {
      outDir: dev ? resolve(import.meta.dirname, '../origo/plugins') : 'build',
      emptyOutDir: false,
      minify: !dev,
      sourcemap: dev ? 'inline' : false,
      lib: {
        entry: resolve(import.meta.dirname, 'help.js'),
        name: 'Help',
        formats: ['iife'],
        fileName: () => (dev ? 'help.js' : 'js/help.min.js'),
        cssFileName: dev ? 'help' : 'css/help'
      },
      rollupOptions: {
        external: ['Origo'],
        output: {
          exports: 'default',
          globals: {
            Origo: 'Origo'
          }
        }
      }
    }
  };
});
