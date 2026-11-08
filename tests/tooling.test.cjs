const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {parseEnv}=require('node:util');
const {sign,verify}=require('node:crypto');
const root=path.resolve(__dirname,'..');
function cleanup(dir) {
 const resolved=path.resolve(dir), temp=path.resolve(os.tmpdir());
 assert.ok(resolved.startsWith(temp+path.sep) && path.basename(resolved).startsWith('nexquiz-'));
 fs.rmSync(resolved,{recursive:true,force:true});
}
test('setup generates independent credentials and a valid RSA pair, preserving existing state',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexquiz-setup-'));
 try {
  fs.copyFileSync(path.join(root,'.env.example'),path.join(dir,'.env.example'));
  const execute=()=>spawnSync(process.execPath,[path.join(root,'scripts/setup.cjs')],{cwd:dir,encoding:'utf8'});
  assert.equal(execute().status,0);
  const envText=fs.readFileSync(path.join(dir,'.env'),'utf8');const env=parseEnv(envText);
  const credentials=['POSTGRES_PASSWORD','AUTH_DB_PASSWORD','GAME_DB_PASSWORD','GRAFANA_PASSWORD'].map(key=>env[key]);
  assert.equal(new Set(credentials).size,4);assert.ok(credentials.every(s=>/^[a-f0-9]{48}$/.test(s)));
  assert.equal(new URL(env.AUTH_DATABASE_URL).password,env.AUTH_DB_PASSWORD);
  assert.equal(new URL(env.GAME_DATABASE_URL).password,env.GAME_DB_PASSWORD);
  const privateKey=fs.readFileSync(path.join(dir,'secrets/jwt-private.pem'),'utf8');const publicKey=fs.readFileSync(path.join(dir,'secrets/jwt-public.pem'),'utf8');
  const payload=Buffer.from('nexquiz-key-pair-check');const signature=sign('RSA-SHA256',payload,privateKey);assert.equal(verify('RSA-SHA256',payload,publicKey,signature),true);
  assert.equal(execute().status,0);assert.equal(fs.readFileSync(path.join(dir,'.env'),'utf8'),envText);assert.equal(fs.readFileSync(path.join(dir,'secrets/jwt-private.pem'),'utf8'),privateKey);
 } finally {cleanup(dir);}
});
test('setup appends keys added by later milestones without touching existing values',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexquiz-setup-upgrade-'));
 try {
  fs.copyFileSync(path.join(root,'.env.example'),path.join(dir,'.env.example'));
  fs.writeFileSync(path.join(dir,'.env'),'POSTGRES_PASSWORD=keep-me\nPOSTGRES_PORT=55432\n');
  const run=spawnSync(process.execPath,[path.join(root,'scripts/setup.cjs')],{cwd:dir,encoding:'utf8'});
  assert.equal(run.status,0);assert.match(run.stdout,/added missing keys: .*DEMO_PASSWORD/);
  const env=parseEnv(fs.readFileSync(path.join(dir,'.env'),'utf8'));
  assert.equal(env.POSTGRES_PASSWORD,'keep-me');assert.equal(env.POSTGRES_PORT,'55432');
  assert.match(env.DEMO_PASSWORD,/^Demo-[A-Za-z0-9_-]{12}$/);assert.ok(!Object.values(env).some(value=>value.includes('CHANGE_')));
  const again=spawnSync(process.execPath,[path.join(root,'scripts/setup.cjs')],{cwd:dir,encoding:'utf8'});
  assert.match(again.stdout,/Existing \.env preserved\./);
 } finally {cleanup(dir);}
});
test('production gate rejects development defaults without exposing credentials',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexquiz-production-'));
 try {fs.copyFileSync(path.join(root,'.env.example'),path.join(dir,'.env'));const run=spawnSync(process.execPath,[path.join(root,'scripts/check-production.cjs')],{cwd:dir,encoding:'utf8'});assert.equal(run.status,1);assert.match(run.stderr,/Production configuration incomplete/);assert.ok(!run.stderr.includes('CHANGE_POSTGRES_PASSWORD'));}finally{cleanup(dir);}
});

test('production gate validates a separate synthetic environment and rejects invalid release targets',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexquiz-production-'));
 try {
  fs.copyFileSync(path.join(root,'.env.example'),path.join(dir,'.env.example'));
  const setup=spawnSync(process.execPath,[path.join(root,'scripts/setup.cjs')],{cwd:dir,encoding:'utf8'});
  assert.equal(setup.status,0);
  fs.copyFileSync(path.join(root,'pnpm-lock.yaml'),path.join(dir,'pnpm-lock.yaml'));
  fs.copyFileSync(path.join(dir,'.env'),path.join(dir,'.env.production'));
  const env={...process.env};
  for(const key of Object.keys(parseEnv(fs.readFileSync(path.join(dir,'.env'),'utf8')))) delete env[key];
  Object.assign(env,{DOCKERHUB_USER:'nexquiz-validation',SITE_ADDRESS:'nexquiz.invalid',CORS_ORIGINS:'https://nexquiz.invalid',JWT_ISSUER:'https://nexquiz.invalid/auth',DOCKER_PLATFORM:'linux/amd64'});
  const run=(extra={})=>spawnSync(process.execPath,[path.join(root,'scripts/check-production.cjs'),'--env-file','.env.production'],{cwd:dir,env:{...env,...extra},encoding:'utf8'});
  assert.equal(run().status,0);
  assert.equal(run({DOCKER_PLATFORM:'linux/arm64'}).status,0);
  assert.equal(run({DOCKER_PLATFORM:'windows/amd64'}).status,1);
  assert.equal(run({DOCKERHUB_USER:'invalid/namespace'}).status,1);
  assert.equal(run({IMAGE_TAG:'invalid:tag'}).status,1);
 } finally {cleanup(dir);}
});
