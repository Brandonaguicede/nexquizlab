// Read-only pre-stage audit. Findings contain paths/categories, never secret values.
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { parseEnv } = require('node:util');
function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Git inventory failed');
  return result.stdout.split('\0').filter(Boolean);
}
const files = [...new Set([...git(['ls-files','-z']), ...git(['ls-files','--others','--exclude-standard','-z'])])];
const local = fs.existsSync('.env') ? parseEnv(fs.readFileSync('.env','utf8')) : {};
const secrets = Object.entries(local).filter(([key,value]) => /PASSWORD|SECRET|TOKEN/.test(key) && value.length >= 12 && !value.startsWith('CHANGE_')).map(([,value])=>value);
const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['JWT literal', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
];
const findings = [];
for (const file of files) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
  if (/^(?:\.env(?:\.|$)(?!example$)|secrets\/)|\.(?:pem|key|p12|pfx|jks|keystore|dump|backup)$/i.test(file)) findings.push([file,'sensitive file eligible for versioning']);
  const text = fs.readFileSync(file,'utf8');
  for (const [category,pattern] of patterns) if (pattern.test(text)) findings.push([file,category]);
  for (const match of text.matchAll(/\b(?:password|passwd|api[_-]?key|access[_-]?token|client[_-]?secret|jwt[_-]?secret)\b\s*[:=]\s*["']([^"'\r\n]{12,})["']/gi)) {
    // These two SQL clauses bind psql variables; they contain no password literals.
    if (file === 'infra/docker/init-databases.sh' && /^PASSWORD\s+:'(?:auth|game)_password'$/i.test(match[0])) continue;
    if (!/CHANGE_|example|fixture|\$\{|test|process\./i.test(match[1])) findings.push([file,'potential literal credential assignment']);
  }
  if (secrets.some(secret => text.includes(secret) || text.includes(encodeURIComponent(secret)))) findings.push([file,'matches an existing local secret']);
  for (const match of text.matchAll(/postgres(?:ql)?:\/\/[^:\s"'<>]+:([^@\s"'<>]+)@/g)) {
    if (!/CHANGE_|\$\{|fixture|example/i.test(match[1])) findings.push([file,'literal database credential']);
  }
  if (/https?:\/\/[^\s/"'<>]+:[^\s/@"'<>]+@/.test(text)) findings.push([file,'HTTP URL with embedded credentials']);
}
if (!files.includes('pnpm-lock.yaml')) findings.push(['pnpm-lock.yaml','missing from versionable inventory']);
for (const file of ['.env','secrets/jwt-private.pem','secrets/jwt-public.pem','node_modules/.modules.yaml','test-results/.last-run.json','apps/auth-api/public/scalar/scalar-1.44.23.js','apps/game-api/public/scalar/scalar-1.44.23.js']) {
  const result = spawnSync('git',['check-ignore','--quiet','--',file]);
  if (result.status !== 0) findings.push([file,'not ignored']);
}
if (findings.length) {
  for (const [file,category] of findings) console.error(file+': '+category);
  process.exitCode = 1;
} else console.log('NexQuiz repository audit passed: '+files.length+' eligible files; local secrets and generated artifacts excluded. Pattern/exact-match scan does not replace manual review.');
