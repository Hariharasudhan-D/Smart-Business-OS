import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Content-Security-Policy for the built site (not the dev server, whose hot reload needs inline scripts).
 * Only this site's own scripts can run, data can only be sent to this site and the API, and pages
 * cannot be put in frames. If something is ever injected into a page, it cannot load outside scripts
 * or send the saved sign-in anywhere else.
 */
function contentSecurityPolicy(apiUrl) {
  let apiOrigin = '';
  try {
    if (/^https?:\/\//.test(apiUrl)) apiOrigin = new URL(apiUrl).origin;
  } catch {
    // relative /api: same origin
  }
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), contentSecurityPolicy(env.VITE_API_URL || '')],
    build: { sourcemap: false },
    server: {
      // Forward /api calls to the Java backend so the browser sees a single origin.
      // The browser's Origin header is dropped, so the backend never needs this dev address in its CORS list.
      proxy: {
        '/api': {
          target: process.env.API_PROXY || 'http://localhost:8080',
          changeOrigin: true,
          configure: (proxy) => proxy.on('proxyReq', (req) => req.removeHeader('origin')),
        },
      },
    },
  };
});
