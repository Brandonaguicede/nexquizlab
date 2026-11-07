import { apiReference } from '@scalar/nestjs-api-reference';
import type { Request, Response } from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

export const SCALAR_VERSION = '1.44.23';
export const SCALAR_BUNDLE_URL = '/docs/scalar-' + SCALAR_VERSION + '.js';
let verifiedBundle: Buffer | undefined;

export function scalarAsset(_req: Request, res: Response) {
  try {
    if (!verifiedBundle) {
      const directory = resolve(__dirname, '../../public/scalar');
      const manifest = JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8')) as { package?: string; version?: string; sha256?: string; integrity?: string; tarball?: string };
      const bundle = readFileSync(resolve(directory, 'scalar-' + SCALAR_VERSION + '.js'));
      if (manifest.package !== '@scalar/api-reference' || manifest.version !== SCALAR_VERSION || !manifest.integrity?.startsWith('sha512-') || !manifest.tarball?.startsWith('https://registry.npmjs.org/') || manifest.sha256 !== createHash('sha256').update(bundle).digest('hex')) throw new Error('Invalid Scalar artifact');
      verifiedBundle = bundle;
    }
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(verifiedBundle);
  } catch {
    res.status(503).send('Official Scalar asset unavailable or invalid. Run pnpm prepare:scalar before starting the API.');
  }
}

export function scalarReference(req: Request, res: Response) {
  const prefix = req.headers['x-forwarded-prefix'] === '/auth' ? '/auth' : '';
  return apiReference({ cdn: prefix + SCALAR_BUNDLE_URL, url: prefix + '/openapi.json', withDefaultFonts: false, telemetry: false })(req, res);
}
