const assert = require('node:assert/strict');
const { parseEnv } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname,'..','.env');
const env = { ...(fs.existsSync(file) ? parseEnv(fs.readFileSync(file,'utf8')) : {}), ...process.env };
const origin = env.CORS_ORIGINS?.split(',')[0] || 'http://localhost:5173';
async function request(base, suffix, headers = {}) {
 return fetch(base.replace(/\/$/,'') + suffix, { headers, signal: AbortSignal.timeout(8000) });
}
(async () => {
 for (const [kind, base] of [['auth',env.AUTH_HTTP_URL || 'http://localhost:'+(env.AUTH_PORT || '3001')],['game',env.GAME_HTTP_URL || 'http://localhost:'+(env.GAME_PORT || '3002')]]) {
  try {
   const expected = 'nexquiz-'+kind+'-api';
   for (const route of ['live','ready']) {
    const response = await request(base,'/api/v1/health/'+route); assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{status:'ok',service:expected});
   }
   const spec = await request(base,'/openapi.json'); assert.equal(spec.status,200); const document = await spec.json();
   assert.ok(document.openapi.startsWith('3.')); assert.ok(document.paths['/api/v1/health/live']); assert.ok(document.paths['/api/v1/health/ready']);
   for (const route of ['/docs','/docs/']) { const response = await request(base,route); assert.equal(response.status,200); const html = await response.text(); assert.match(html,/scalar/i); assert.match(html,/openapi.json/); }
   const cors = await request(base,'/api/v1/health/live',{Origin:origin}); assert.equal(cors.headers.get('access-control-allow-origin'),origin);
   const denied = await request(base,'/api/v1/health/live',{Origin:'https://nexquiz-untrusted.invalid'}); assert.equal(denied.headers.get('access-control-allow-origin'),null);
   const missing = await request(base,'/api/v1/nexquiz-hito-1-missing'); assert.equal(missing.status,404); const error = await missing.json(); assert.equal(error.statusCode,404); assert.ok(!('stack' in error));
   console.log(expected+': health, OpenAPI, Scalar HTML, CORS and HTTP 404 passed. Browser rendering of Scalar remains a separate check.');
  } catch (error) { console.error('nexquiz-'+kind+'-api: verification failed ('+(error.cause?.code || error.code || error.message)+').'); process.exitCode=1; }
 }
})().catch(()=>{console.error('HTTP verification failed.');process.exitCode=1;});

