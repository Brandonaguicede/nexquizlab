import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Request, Response } from 'express';
import { scalarReference as authDocs, scalarAsset as authAsset, SCALAR_BUNDLE_URL } from '../../apps/auth-api/src/presentation/scalar';
import { scalarReference as gameDocs, scalarAsset as gameAsset } from '../../apps/game-api/src/presentation/scalar';

// Isolated documentation transport fixture: production handlers, synthetic public contract.
// Does not connect to a database, replace a running stack, or exercise Caddy/Nginx.
let server: Server;
let base: string;
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const api = req.url?.startsWith('/auth/') ? 'auth' : 'game';
    if (req.url === '/' + api + SCALAR_BUNDLE_URL) {
      const response = {
        setHeader(name: string, value: string) { res.setHeader(name, value); },
        status(code: number) { res.statusCode = code; return response; },
        send(body: string | Buffer) { res.end(body); },
      };
      (api === 'auth' ? authAsset : gameAsset)(req as Request, response as unknown as Response);
    } else if (req.url?.endsWith('/openapi.json')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ openapi: '3.0.3', info: { title: 'NexQuiz ' + api + ' documentation fixture', version: '1.0.0' }, servers: [{ url: '/' + api }], paths: { '/api/v1/health/live': { get: { summary: 'Process health', responses: { '200': { description: 'Available' } } } } } }));
    } else if (/^\/(auth|game)\/docs\/?$/.test(req.url || '')) {
      req.headers['x-forwarded-prefix'] = '/' + api;
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:; img-src 'self' data:");
      const response = { send(html: string) { res.setHeader('Content-Type', 'text/html'); res.end(html); } };
      (api === 'auth' ? authDocs : gameDocs)(req as Request, response as Response);
    } else { res.statusCode = 204; res.end(); }
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
test.afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

for (const api of ['auth', 'game']) for (const slash of ['', '/']) {
  test('renders versioned Scalar at /' + api + '/docs' + slash, async ({ page }) => {
    const errors: string[] = [];
    const externalRequests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin !== base) {
        externalRequests.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    const bundleResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/' + api + SCALAR_BUNDLE_URL);
    await page.goto(base + '/' + api + '/docs' + slash);
    await expect(page.locator('script[src]')).toHaveAttribute('src', '/' + api + SCALAR_BUNDLE_URL);
    expect((await bundleResponse).status(), 'Prepare the official local artifact with pnpm prepare:scalar; no fake bundle is allowed').toBe(200);
    expect(externalRequests).toEqual([]);
    expect(errors).toEqual([]);
    await expect(page.locator('#app')).toContainText('NexQuiz ' + api + ' documentation fixture');
    await expect(page.locator('#app')).toContainText('/api/v1/health/live');
    expect(externalRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
}
