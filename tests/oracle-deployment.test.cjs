const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseEnv } = require('node:util');
const { createPrivateKey, createPublicKey } = require('node:crypto');
const root = path.resolve(__dirname, '..');
test('Oracle setup isolates credentials, produces valid ARM64 production config and refuses overwrite', () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexquiz-oracle-'));
 try {
  fs.copyFileSync(path.join(root, '.env.example'), path.join(dir, '.env.example'));
  fs.copyFileSync(path.join(root, 'pnpm-lock.yaml'), path.join(dir, 'pnpm-lock.yaml'));
  fs.writeFileSync(path.join(dir, '.env'), 'LOCAL_SENTINEL=preserve\n');
  const execute = site => spawnSync(process.execPath, [path.join(root, 'scripts/setup-oracle.cjs'), site], { cwd: dir, encoding: 'utf8' });
  for (const site of ['localhost', 'https://site.org', '1.2.3.4', '../site.org', 'site.invalid', 'bad..org', '-bad.org']) assert.notEqual(execute(site).status, 0);
  assert.ok(!fs.existsSync(path.join(dir, '.env.oracle')));
  // Format fixture only; never resolves or provisions this hostname.
  const result = execute('nexquiz-fixture.duckdns.org');
  assert.equal(result.status, 0, result.stderr);
  const text = fs.readFileSync(path.join(dir, '.env.oracle'), 'utf8'), env = parseEnv(text);
  assert.equal(env.DOCKER_PLATFORM, 'linux/arm64');
  assert.equal(env.DEMO_SEED, 'false');
  assert.equal(env.CORS_ORIGINS, 'https://nexquiz-fixture.duckdns.org');
  const secrets = ['POSTGRES_PASSWORD', 'AUTH_DB_PASSWORD', 'GAME_DB_PASSWORD', 'GRAFANA_PASSWORD', 'DEMO_PASSWORD'].map(key => env[key]);
  assert.equal(new Set(secrets).size, 5);
  assert.ok(secrets.every(secret => /^[a-f0-9]{48}$/.test(secret) && !result.stdout.includes(secret)));
  assert.equal(new URL(env.AUTH_DATABASE_URL).password, env.AUTH_DB_PASSWORD);
  assert.equal(new URL(env.GAME_DATABASE_URL).password, env.GAME_DB_PASSWORD);
  const privateKey = createPrivateKey(fs.readFileSync(path.join(dir, env.JWT_PRIVATE_KEY_FILE)));
  const publicKey = createPublicKey(fs.readFileSync(path.join(dir, env.JWT_PUBLIC_KEY_FILE)));
  assert.equal(createPublicKey(privateKey).export({type:'spki',format:'pem'}), publicKey.export({type:'spki',format:'pem'}));
  assert.equal(execute('another-fixture.duckdns.org').status, 1);
  assert.equal(fs.readFileSync(path.join(dir, '.env.oracle'), 'utf8'), text);
  assert.equal(fs.readFileSync(path.join(dir, '.env'), 'utf8'), 'LOCAL_SENTINEL=preserve\n');
  const gate = spawnSync(process.execPath, [path.join(root, 'scripts/check-production.cjs'), '--env-file', '.env.oracle'], { cwd: dir, encoding: 'utf8', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot } });
  assert.equal(gate.status, 0, gate.stderr);
 } finally {
  const resolved = path.resolve(dir);
  assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('nexquiz-oracle-'));
  fs.rmSync(resolved, { recursive: true, force: true });
 }
});
