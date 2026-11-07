// Explicit opt-in PostgreSQL integration. Keeps test identities; never resets/deletes data.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { randomUUID } = require('node:crypto');
const env = parseEnv(fs.readFileSync(path.join(__dirname,'../../.env'),'utf8'));
const port = process.env.NEXQUIZ_TEST_DB_PORT;
if (!port || port === '5432' || !/^\d+$/.test(port)) throw new Error('Set NEXQUIZ_TEST_DB_PORT to the verified NexQuiz host port (this machine: 55432). Never target the unrelated default PostgreSQL.');
const url = new URL(env.AUTH_DATABASE_URL);
if (url.pathname !== '/nexquiz_auth' || !['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('Expected local isolated Auth database');
url.port = port;
process.env.AUTH_DATABASE_URL = url.toString();
require('../../apps/auth-api/node_modules/ts-node').register({ project: path.join(__dirname,'../../apps/auth-api/tsconfig.json') });
const { PrismaService } = require('../../apps/auth-api/src/infrastructure/prisma.service.ts');
const { PrismaIdentityRepository, PrismaTrafficGate } = require('../../apps/auth-api/src/infrastructure/identity.repository.ts');
const { RandomSessionSecrets } = require('../../apps/auth-api/src/infrastructure/passwords.ts');
const db = new PrismaService(), repo = new PrismaIdentityRepository(db), secrets = new RandomSessionSecrets();
after(async () => db.$disconnect());
async function user() { return repo.register('identity-test-'+randomUUID()+'@example.invalid','Persistence test','test-not-a-login-hash'); }
test('database identity is nexquiz_auth and independent Game credentials cannot connect', async () => {
 const [identity] = await db.$queryRaw`SELECT current_database() AS name`;
 assert.equal(identity.name,'nexquiz_auth');
 const { PrismaClient } = require('../../apps/game-api/generated/client');
 const crossed = new URL(env.GAME_DATABASE_URL); crossed.port=port; crossed.pathname='/nexquiz_auth';
 const forbidden = new PrismaClient({ datasources: { db: { url: crossed.toString() } } });
 try { await assert.rejects(forbidden.$queryRaw`SELECT 1`); } finally { await forbidden.$disconnect(); }
});
test('case-insensitive concurrent duplicate registration has one winner', async () => {
 const email = 'identity-test-'+randomUUID()+'@example.invalid';
 const results = await Promise.allSettled([repo.register(email,'Test','test-hash'),repo.register(email.toUpperCase(),'Test','test-hash')]);
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 assert.equal(results.find(result=>result.status==='rejected').reason.code,'DUPLICATE_EMAIL');
});
test('refresh is single-use across concurrent connections and replay commits revocation', async () => {
 const owner = await user(), secret=secrets.generate(), hash=secrets.digest(secret);
 const session=await repo.createSession(owner.id,hash,new Date(Date.now()+60000));
 const results=await Promise.all([repo.rotate(hash,secrets.digest(secrets.generate()),new Date()),repo.rotate(hash,secrets.digest(secrets.generate()),new Date())]);
 assert.equal(results.filter(Boolean).length,1);
 assert.equal(await repo.profile(owner.id,session.sessionId,new Date()),null);
 assert.ok((await db.session.findUnique({where:{id:session.sessionId}})).revokedAt);
});
test('expired sessions neither rotate nor expose profile', async () => {
 const owner=await user(), hash=secrets.digest(secrets.generate());
 const session=await repo.createSession(owner.id,hash,new Date(Date.now()-1000));
 assert.equal(await repo.rotate(hash,secrets.digest(secrets.generate()),new Date()),null);
 assert.equal(await repo.profile(owner.id,session.sessionId,new Date()),null);
});
test('rotation keeps absolute expiry and logout revokes current and historical refresh tokens', async () => {
 const owner=await user(), hash=secrets.digest(secrets.generate()), next=secrets.digest(secrets.generate());
 const expires=new Date(Date.now()+60000);
 const initial=await repo.createSession(owner.id,hash,expires);
 const rotated=await repo.rotate(hash,next,new Date());
 assert.equal(rotated.expiresAt.getTime(),expires.getTime());
 await repo.revoke(hash);
 assert.equal(await repo.rotate(next,secrets.digest(secrets.generate()),new Date()),null);
 assert.equal(await repo.profile(owner.id,initial.sessionId,new Date()),null);
 const stored=await db.refreshToken.findMany({where:{sessionId:initial.sessionId}});
 assert.ok(stored.every(value=>/^[a-f0-9]{64}$/.test(value.hash)));
});
test('distributed rate bucket increments atomically before enforcing its limit', async () => {
 const traffic=new PrismaTrafficGate(db), key='integration-test:'+randomUUID();
 const result=await Promise.allSettled(Array.from({length:4},()=>traffic.consume(key,2)));
 assert.equal(result.filter(value=>value.status==='fulfilled').length,2);
 assert.ok(result.filter(value=>value.status==='rejected').every(value=>value.reason.code==='RATE_LIMITED'));
});
