// Run in the repository root ON THE VM. No cloud API or paid resource is created.
const fs = require('node:fs');
const { randomBytes, generateKeyPairSync } = require('node:crypto');
const { isIP } = require('node:net');
const { parseEnv } = require('node:util');
function setup(site) {
 if (!site || isIP(site) || !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(site) || !site.includes('.') || site.split('.').some(label => !label || label.length > 63 || label.startsWith('-') || label.endsWith('-')) || /(^|\.)(localhost|invalid|example|test)$/.test(site)) throw new Error('Provide a real public DNS hostname, without https:// or paths.');
 const envFile = '.env.oracle', directory = 'secrets/oracle';
 if (fs.existsSync(envFile)) throw new Error('.env.oracle already exists; preserved. Edit it explicitly instead of regenerating credentials.');
 fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
 const privatePath = directory + '/jwt-private.pem', publicPath = directory + '/jwt-public.pem';
 if (fs.existsSync(privatePath) !== fs.existsSync(publicPath)) throw new Error('Incomplete Oracle key pair; restore it before continuing.');
 const env = parseEnv(fs.readFileSync('.env.example', 'utf8'));
 for (const key of ['POSTGRES_PASSWORD', 'AUTH_DB_PASSWORD', 'GAME_DB_PASSWORD', 'GRAFANA_PASSWORD', 'DEMO_PASSWORD']) env[key] = randomBytes(24).toString('hex');
 Object.assign(env, { NODE_ENV: 'production', DOCKER_PLATFORM: 'linux/arm64', DOCKERHUB_USER: 'nexquiz-local', IMAGE_TAG: 'oracle-1.0.0', SITE_ADDRESS: site, CORS_ORIGINS: 'https://' + site, JWT_ISSUER: 'https://' + site + '/auth', PUBLIC_WEB_URL: 'https://' + site, RESULTS_CLIENT_ORIGIN: 'https://' + site, OTEL_SDK_DISABLED: 'false', DEMO_SEED: 'false', GAME_MAX_PARTICIPANTS: '50', JWT_PRIVATE_KEY_FILE: privatePath, JWT_PUBLIC_KEY_FILE: publicPath });
 env.AUTH_DATABASE_URL = `postgresql://${env.AUTH_DB_USER}:${env.AUTH_DB_PASSWORD}@postgres:5432/nexquiz_auth?schema=public`;
 env.GAME_DATABASE_URL = `postgresql://${env.GAME_DB_USER}:${env.GAME_DB_PASSWORD}@postgres:5432/nexquiz_game?schema=public`;
 if (!fs.existsSync(privatePath)) {
  const keys = generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  // Containers run as a non-root UID. Parent directory is private; mounted files must be readable by that UID.
  fs.writeFileSync(privatePath, keys.privateKey, { mode: 0o444, flag: 'wx' });
  fs.writeFileSync(publicPath, keys.publicKey, { mode: 0o444, flag: 'wx' });
 }
 fs.writeFileSync(envFile, Object.entries(env).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
 console.log('Created .env.oracle and isolated Oracle keys. Local .env and keys preserved. No credentials printed.');
}
if (require.main === module) {
 try { if (process.argv.length !== 3) throw new Error('Usage: node scripts/setup-oracle.cjs <public-hostname>'); setup(process.argv[2]); }
 catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { setup };
