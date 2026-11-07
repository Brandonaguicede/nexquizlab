// Build-time acquisition only. No CDN or package manager is used by the running APIs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const version = '1.44.23';
const packageName = '@scalar/api-reference';
// Pin bytes as well as version; verified against the official npm dist.integrity.
const expectedIntegrity = 'sha512-3ZBSMUT5SEr/YUfw/pu/dn12Qo0kpqUtwzM5QXo+t7KJ/wWJW5AVB9Lhdg5+0DXRd33OV78SraC15leNP3FFeg==';
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--app' || !['auth','game'].includes(args[1]))) throw new Error('Usage: node scripts/prepare-scalar.cjs [--app auth|game]');
const apps = args.length ? [args[1]] : ['auth','game'];
const cache = path.join(root, '.cache', 'scalar');
fs.mkdirSync(cache, { recursive: true });
// Official Windows Node and the Linux node Docker image use different npm prefixes.
const npmCli = [
  path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
  path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
].find(file => fs.existsSync(file));
function npm(parameters) {
  if (!npmCli) throw new Error('npm CLI not found. Install Node 24 with npm.');
  const result = spawnSync(process.execPath, [npmCli, ...parameters, '--registry=https://registry.npmjs.org/', '--cache='+path.join(root,'.cache/npm'), '--fetch-retries=0', '--fetch-timeout=10000'], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error('Official Scalar package acquisition failed ('+(result.error?.code || (/EACCES/.test(result.stderr) ? 'EACCES' : 'npm exit '+result.status))+'). Run pnpm prepare:scalar in an authorized terminal with registry access.');
  return JSON.parse(result.stdout);
}
function tar(archive, entry) {
  const result = spawnSync('tar', ['-xOf', archive, entry], { maxBuffer: 40 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error('Cannot read official Scalar archive entry: '+entry+'. Install tar if unavailable.');
  return result.stdout;
}
try {
  const metadata = npm(['view', packageName+'@'+version, '--json']);
  if (metadata.name !== packageName || metadata.version !== version || !metadata.dist?.integrity?.startsWith('sha512-') || !metadata.dist.tarball.startsWith('https://registry.npmjs.org/')) throw new Error('Unexpected official Scalar metadata.');
  const packs = npm(['pack', packageName+'@'+version, '--json', '--ignore-scripts', '--pack-destination='+cache]);
  const pack = packs[0];
  if (pack?.name !== packageName || pack.version !== version || path.basename(pack.filename) !== pack.filename) throw new Error('Unexpected npm pack result.');
  const archive = path.join(cache, pack.filename);
  const integrity = 'sha512-'+crypto.createHash('sha512').update(fs.readFileSync(archive)).digest('base64');
  if (integrity !== expectedIntegrity || integrity !== metadata.dist.integrity || integrity !== pack.integrity) throw new Error('Official Scalar tarball integrity mismatch.');
  const info = JSON.parse(tar(archive, 'package/package.json').toString('utf8'));
  if (info.name !== packageName || info.version !== version || info.license !== 'MIT') throw new Error('Unexpected Scalar archive identity/license.');
  // This public export is the prebuilt standalone renderer, not the Vue module entry.
  const browserExport = info.exports?.['./browser/standalone.js'];
  if (typeof browserExport !== 'string' || browserExport !== info.browser) throw new Error('Official package browser export does not match browser metadata.');
  const browser = browserExport.replace(/^\.\//, '');
  if (!/^[a-zA-Z0-9_./-]+\.js$/.test(browser) || browser.split('/').includes('..')) throw new Error('Official package does not declare a supported browser bundle.');
  const entries = (pack.files || []).map(file => file.path);
  if (!entries.includes(browser)) throw new Error('Browser bundle missing from package inventory.');
  const license = entries.find(file => /^(?:LICENSE|LICENSE\.md|LICENSE\.txt)$/i.test(file));
  const bundle = tar(archive, 'package/'+browser);
  // 1.44.23 omits LICENSE from its tarball. Retain Scalar's upstream MIT text,
  // also shipped by the pinned NestJS integration, without a build-time GitHub fetch.
  const notice = license ? tar(archive, 'package/'+license) : fs.readFileSync(path.join(__dirname, 'vendor/scalar-LICENSE'));
  const manifest = { package: packageName, version, tarball: metadata.dist.tarball, integrity, browser, sha256: crypto.createHash('sha256').update(bundle).digest('hex') };
  for (const app of apps) {
    const target = path.join(root, 'apps', app+'-api', 'public', 'scalar');
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'scalar-'+version+'.js'), bundle);
    fs.writeFileSync(path.join(target, 'LICENSE'), notice);
    fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest,null,2)+'\n');
  }
  console.log('Official Scalar '+version+' prepared for '+apps.join(', ')+'. Tarball SHA-512 and browser SHA-256 verified; license retained.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
