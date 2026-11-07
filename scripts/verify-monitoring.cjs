const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const file = path.join(__dirname,'..','.env');
const env = { ...(fs.existsSync(file) ? parseEnv(fs.readFileSync(file,'utf8')) : {}), ...process.env };
const base = new URL(env.GRAFANA_HTTP_URL || 'http://localhost:3000');
if(base.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(base.hostname)) throw new Error('Use HTTPS for remote Grafana credentials.');
if (!env.GRAFANA_USER || !env.GRAFANA_PASSWORD) throw new Error('Configure Grafana credentials.');
const authorization = 'Basic '+Buffer.from(env.GRAFANA_USER+':'+env.GRAFANA_PASSWORD).toString('base64');
async function get(suffix) { const response=await fetch(new URL(suffix,base),{headers:{authorization},signal:AbortSignal.timeout(8000),redirect:'error'});assert.equal(response.status,200);return response.json(); }
(async()=>{
 const health=await get('/api/health');assert.equal(health.database,'ok');
 const dashboard=await get('/api/dashboards/uid/nexquiz-overview');assert.equal(dashboard.dashboard.uid,'nexquiz-overview');
 for(const metric of ['nexquiz_http_requests_total','nexquiz_http_duration_seconds_count','nexquiz_service_ready']) {
  const result=await get('/api/datasources/proxy/uid/nexquiz-prometheus/api/v1/query?query='+encodeURIComponent(metric));assert.equal(result.status,'success');
  for(const api of ['nexquiz-auth-api','nexquiz-game-api']) {
   const samples=result.data.result.filter(sample=>sample.metric.api===api);assert.ok(samples.length>0,'No '+metric+' samples for '+api);
   assert.ok(samples.some(sample=>Number(sample.value[1])>0),'No successful observation for '+api+' / '+metric);
  }
 }
 // Hito 6: black-box availability of every team service, game gauges and traces in Tempo.
 for(const metric of ['httpcheck_status','nexquiz_game_sessions']) {
  const result=await get('/api/datasources/proxy/uid/nexquiz-prometheus/api/v1/query?query='+encodeURIComponent(metric));
  assert.ok(result.data.result.length>0,'No samples for '+metric);
 }
 const down=await get('/api/datasources/proxy/uid/nexquiz-prometheus/api/v1/query?query='+encodeURIComponent('max by (http_url) (httpcheck_status{http_status_class="2xx"}) == 0'));
 assert.equal(down.data.result.length,0,'Service not responding 2xx: '+down.data.result.map(sample=>sample.metric.http_url).join(', '));
 const tempo=await get('/api/datasources/uid/nexquiz-tempo');assert.equal(tempo.type,'tempo');
 for(const service of ['nexquiz-game-api','nexquiz-auth-api']) {
  const search=await get('/api/datasources/proxy/uid/nexquiz-tempo/api/search?limit=5&tags='+encodeURIComponent('service.name='+service));
  assert.ok((search.traces||[]).length>0,'No traces in Tempo for '+service);
 }
 console.log('Grafana API, provisioned dashboard, HTTP/readiness samples from both APIs, black-box availability of web/client/APIs, game gauges and Tempo traces for both APIs passed. Visual dashboard rendering still requires browser inspection.');
})().catch(error=>{console.error('Monitoring verification failed ('+(error.cause?.code || error.code || error.message)+'). No monitoring completion claimed.');process.exitCode=1;});

