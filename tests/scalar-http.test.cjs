// Scalar core is ESM: exercise the installed integration in Node 24, outside Jest's CJS VM.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const crypto = require('node:crypto');
require('../apps/auth-api/node_modules/ts-node').register({ project: path.join(__dirname,'../apps/auth-api/tsconfig.json') });

for (const api of ['auth','game']) {
  const { scalarReference, scalarAsset, SCALAR_BUNDLE_URL } = require('../apps/'+api+'-api/src/presentation/scalar.ts');
  test(api+' local bundle serves verified real bytes or explicitly reports missing preparation', async () => {
    let status = 200, body;
    const response = { setHeader() {}, status(code) { status = code; return response; }, send(value) { body = value; } };
    scalarAsset({}, response);
    const directory = path.join(__dirname,'../apps',api+'-api/public/scalar');
    if (fs.existsSync(path.join(directory,'manifest.json'))) {
      const manifest = JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
      assert.equal(status,200);
      assert.equal(crypto.createHash('sha256').update(body).digest('hex'),manifest.sha256);
    } else {
      assert.equal(status,503);
      assert.match(body,/Run pnpm prepare:scalar/);
    }
  });
  const scenarios = [
    ['/docs', '', '/openapi.json'],
    ['/docs/', '', '/openapi.json'],
    ['/docs', '/'+api, '/'+api+'/openapi.json'],
    ['/docs/', '/'+api, '/'+api+'/openapi.json'],
    ['/docs', 'https://untrusted.invalid', '/openapi.json'],
  ];
  for (const [route,prefix,url] of scenarios) test(api+' Scalar '+route+' prefix='+prefix, async () => {
    const server = http.createServer((req,res) => {
      scalarReference(req, { send(html) { res.setHeader('Content-Type','text/html'); res.end(html); } });
    });
    await new Promise((resolve,reject) => { server.once('error',reject); server.listen(0,'127.0.0.1',resolve); });
    try {
      const response = await fetch('http://127.0.0.1:'+server.address().port+route, { headers: { 'X-Forwarded-Prefix': prefix }, signal: AbortSignal.timeout(5000) });
      assert.equal(response.status,200);
      const html = await response.text();
      const expectedPrefix = prefix === '/'+api ? prefix : '';
      assert.ok(html.includes('src="'+expectedPrefix+SCALAR_BUNDLE_URL+'"'));
      assert.ok(html.includes('"url": "'+url+'"'));
      assert.ok(!html.includes('src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"'));
      assert.ok(!html.includes('https://cdn.jsdelivr.net'));
      assert.ok(!html.includes('untrusted.invalid'));
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
}
