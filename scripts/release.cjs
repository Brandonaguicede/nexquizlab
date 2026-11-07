const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { parseEnv } = require('node:util');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--env-file')) throw new Error('Usage: node scripts/release.cjs [--env-file path]');
const envFile = args[1] || '.env';
const env = { ...(fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile,'utf8')) : {}), ...process.env };
const { DOCKERHUB_USER: namespace, IMAGE_TAG: tag, DOCKER_PLATFORM: platform = 'linux/amd64' } = env;
if (!namespace || !/^[a-z0-9][a-z0-9_-]*$/.test(namespace) || !tag || !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$/.test(tag) || tag === 'latest') throw new Error('Set DOCKERHUB_USER and a versioned IMAGE_TAG.');
if (!fs.existsSync('pnpm-lock.yaml')) throw new Error('Run pnpm install and commit the generated lockfile first.');
if (!['linux/amd64','linux/arm64'].includes(platform)) throw new Error('DOCKER_PLATFORM must be linux/amd64 or linux/arm64.');
const images = [['web','web'],['auth-api','auth-api'],['game-api','game-api'],['results-client','results-client']];
for (const [name,dir] of images) {
 const result = spawnSync('docker',['build','--pull','--platform',platform,'--label','org.opencontainers.image.title=nexquiz-'+name,'--label','org.opencontainers.image.version='+tag,'-f', 'apps/'+dir+'/Dockerfile','-t',namespace+'/nexquiz-'+name+':'+tag,'.'], { stdio: 'inherit' });
 if (result.error) console.error('Docker build could not start: '+result.error.code);
 if (result.error || result.status !== 0) process.exit(1);
}
console.log('Images built locally. After validating them, publish explicitly (docker login first):');
for (const [name] of images) console.log('  docker push '+namespace+'/nexquiz-'+name+':'+tag);
