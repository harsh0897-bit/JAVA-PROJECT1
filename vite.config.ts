import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function cyberfusionStandalonePreviewPlugin(): Plugin {
  return {
    name: 'cyberfusion-standalone-preview',
    enforce: 'pre',
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          injectTo: 'head-prepend',
          children: `
(function () {
  try {
    var origFetch = window.fetch ? window.fetch.bind(window) : undefined;
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      enumerable: true,
      get: function () {
        return window.__cfxFetch || origFetch;
      },
      set: function (fn) {
        window.__cfxFetch = fn;
      }
    });
  } catch (e) {}
})();
          `.trim(),
        },
      ];
    },
    transform(code, id) {
      const normId = id.replace(/\\/g, '/');
      if (normId.endsWith('/src/fallback/installStandaloneDemoFallback.ts')) {
        return {
          code: code.replace(
            'window.fetch = async (',
            `const __cfxFetchTarget = {
    set fetch(fn: typeof window.fetch) {
      (window as any).__cfxFetch = fn;
      try {
        Object.defineProperty(window, 'fetch', {
          value: fn,
          writable: true,
          configurable: true,
        });
      } catch {}
      try {
        window.fetch = fn;
      } catch {}
    },
  };
  __cfxFetchTarget.fetch = async (`
          ),
          map: null,
        };
      }
      if (
        normId.endsWith('/src/App.tsx') ||
        normId.endsWith('/src/components/AuthPortalView.tsx') ||
        normId.endsWith('/src/components/ForensicReportView.tsx')
      ) {
        return {
          code:
            `const fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => ((window as any).__cfxFetch || window.fetch)(input, init);\n` +
            code,
          map: null,
        };
      }
      return null;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (url.startsWith('/api/v1/stream/cases')) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });
          res.write(
            'event: progress\ndata: {"stage":"READY","message":"Java 21 Virtual Threads & SSE Active","percent":100}\n\n'
          );
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [cyberfusionStandalonePreviewPlugin(), react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    outDir: 'public-spa',
  },
});

