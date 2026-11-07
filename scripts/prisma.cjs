const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { spawnSync } = require('node:child_process');
const [service, operation] = process.argv.slice(2);
const operations = { generate: ['generate'], validate: ['validate'], deploy: ['migrate','deploy'] };
if (!['auth','game'].includes(service) || !Object.hasOwn(operations,operation)) throw new Error('Usage: node scripts/prisma.cjs <auth|game> <generate|validate|deploy>');
const root = path.resolve(__dirname,'..');
const app = path.join(root,'apps',service+'-api');
const envFile = path.join(root,'.env');
const env = { ...(fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile,'utf8')) : {}), ...process.env };
const cli = path.join(app,'node_modules','prisma','build','index.js');
if (!fs.existsSync(cli)) { console.error('Prisma is not installed for nexquiz-'+service+'-api. Run pnpm install first.'); process.exit(1); }
const result = spawnSync(process.execPath,[cli,...operations[operation]],{cwd:app,env,stdio:'inherit'});
if (result.error) console.error('Could not start Prisma: '+result.error.code);
process.exitCode = result.error ? 1 : (result.status ?? 1);

