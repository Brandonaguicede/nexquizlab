const { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } = require('node:fs');
const { randomBytes, generateKeyPairSync } = require('node:crypto');
const { parseEnv } = require('node:util');
const secret = key => key === 'DEMO_PASSWORD' ? 'Demo-' + randomBytes(9).toString('base64url') : randomBytes(24).toString('hex');
// One value per placeholder: CHANGE_AUTH_DB_PASSWORD also appears inside AUTH_DATABASE_URL and must match.
const generated = new Map();
const fill = text => text.replace(/CHANGE_([A-Z_]+)/g, (_match, key) => { if (!generated.has(key)) generated.set(key, secret(key)); return generated.get(key); });
const example = readFileSync('.env.example', 'utf8');
if (!existsSync('.env')) {
  writeFileSync('.env', fill(example), { mode: 0o600 });
  console.log('Created .env with independent random credentials.');
} else {
  // Never overwrite existing values; only append keys introduced by later milestones.
  const current = parseEnv(readFileSync('.env', 'utf8'));
  const missing = example.split(/\r?\n/).filter(line => /^[A-Z][A-Z0-9_]*=/.test(line) && !(line.split('=')[0] in current));
  if (missing.length) {
    appendFileSync('.env', '\n# Added by setup from .env.example\n' + fill(missing.join('\n')) + '\n');
    console.log('Existing .env preserved; added missing keys: ' + missing.map(line => line.split('=')[0]).join(', ') + '.');
  } else console.log('Existing .env preserved.');
}
mkdirSync('secrets', { recursive: true });
if (existsSync('secrets/jwt-private.pem') !== existsSync('secrets/jwt-public.pem')) throw new Error('Incomplete key pair; restore matching keys before setup.');
if (!existsSync('secrets/jwt-private.pem') && !existsSync('secrets/jwt-public.pem')) {
  const keys = generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  writeFileSync('secrets/jwt-private.pem', keys.privateKey, { mode: 0o600 });
  writeFileSync('secrets/jwt-public.pem', keys.publicKey, { mode: 0o644 });
  console.log('Generated RS256 keys. Private key belongs exclusively to Auth API.');
} else console.log('Existing key material preserved; rotation is an explicit operation.');
