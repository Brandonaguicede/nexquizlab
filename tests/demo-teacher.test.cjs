const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ensureDemoTeacher } = require('../apps/auth-api/scripts/start.cjs');
const validators = { Email: class { constructor(value) { this.value = value.toLowerCase(); } }, validatePassword(value) { assert.ok(value.length >= 12); } };
const env = { DEMO_SEED: 'true', DEMO_PASSWORD: 'demo long password' };
test('disabled demo performs no database or password work', async () => {
 await ensureDemoTeacher(null, null, { DEMO_SEED: 'false' }, null);
 await ensureDemoTeacher(null, null, {}, null);
});
test('fresh demo creates one teacher and repeated startup preserves credentials', async () => {
 let stored = null, writes = 0, hashes = 0;
 const db = { user: { findFirst: async () => stored, upsert: async input => { writes++; assert.deepEqual(input.update, {}); stored = input.create; return stored; } } };
 const passwords = { hash: async value => { hashes++; assert.equal(value, env.DEMO_PASSWORD); return 'secure-hash'; } };
 await ensureDemoTeacher(db, passwords, env, validators);
 await ensureDemoTeacher(db, passwords, { ...env, DEMO_PASSWORD: 'changed password' }, validators);
 assert.equal(writes, 1); assert.equal(hashes, 1);
 assert.equal(stored.email, 'docente@nexquiz.demo'); assert.equal(stored.role, 'TEACHER'); assert.equal(stored.passwordHash, 'secure-hash');
});
test('existing student is never promoted', async () => {
 const db = { user: { findFirst: async () => ({ role: 'STUDENT' }) } };
 await assert.rejects(ensureDemoTeacher(db, null, env, validators), /non-teacher/);
});
test('concurrent registration of a student is never promoted by upsert', async () => {
 const db = { user: { findFirst: async () => null, upsert: async input => { assert.deepEqual(input.update, {}); return { role: 'STUDENT' }; } } };
 await assert.rejects(ensureDemoTeacher(db, { hash: async () => 'hash' }, env, validators), /non-teacher/);
});
test('missing demo password fails before creating an account', async () => {
 const db = { user: { findFirst: async () => null } };
 await assert.rejects(ensureDemoTeacher(db, null, { DEMO_SEED: 'true' }, validators));
});
