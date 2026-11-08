const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
function fixture() {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nexquiz-prisma-'));
 fs.mkdirSync(path.join(root,'scripts'));fs.copyFileSync(path.join(__dirname,'../scripts/prisma.cjs'),path.join(root,'scripts/prisma.cjs'));
 fs.mkdirSync(path.join(root,'apps/auth-api/node_modules/prisma/build'),{recursive:true});
 fs.writeFileSync(path.join(root,'apps/auth-api/node_modules/prisma/build/index.js'),'console.log(JSON.stringify({cwd:process.cwd(),url:process.env.AUTH_DATABASE_URL,args:process.argv.slice(2)})); process.exitCode=Number(process.env.NEXQUIZ_TEST_EXIT||0);');
 fs.writeFileSync(path.join(root,'.env'),'AUTH_DATABASE_URL=postgresql://fixture-only@localhost/nexquiz_auth');
 return root;
}
function cleanup(root) { const target=path.resolve(root);assert.ok(target.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(target).startsWith('nexquiz-prisma-'));fs.rmSync(target,{recursive:true,force:true}); }
test('Prisma runner resolves root environment independently of cwd and preserves explicit environment',()=>{
 const root=fixture();try {
  const env={...process.env};delete env.AUTH_DATABASE_URL;
  const execute=(operation,extra={})=>spawnSync(process.execPath,[path.join(root,'scripts/prisma.cjs'),'auth',operation],{cwd:os.tmpdir(),env:{...env,...extra},encoding:'utf8'});
  for(const [operation,expected] of [['generate',['generate']],['validate',['validate']],['deploy',['migrate','deploy']]]){
   const result=execute(operation);assert.equal(result.status,0);const observed=JSON.parse(result.stdout);assert.deepEqual(observed.args,expected);assert.equal(observed.cwd,path.join(root,'apps/auth-api'));assert.equal(observed.url,'postgresql://fixture-only@localhost/nexquiz_auth');
  }
  const overridden=execute('validate',{AUTH_DATABASE_URL:'postgresql://fixture-override@localhost/nexquiz_auth'});assert.equal(JSON.parse(overridden.stdout).url,'postgresql://fixture-override@localhost/nexquiz_auth');
  assert.equal(execute('validate',{NEXQUIZ_TEST_EXIT:'7'}).status,7);
 } finally {cleanup(root);}
});
test('Prisma runner rejects destructive or unsupported commands and missing dependencies',()=>{
 const root=fixture();try {
  const invalid=spawnSync(process.execPath,[path.join(root,'scripts/prisma.cjs'),'auth','reset'],{encoding:'utf8'});assert.equal(invalid.status,1);assert.match(invalid.stderr,/Usage:/);
  const missing=spawnSync(process.execPath,[path.join(root,'scripts/prisma.cjs'),'game','validate'],{encoding:'utf8'});assert.equal(missing.status,1);assert.match(missing.stderr,/Prisma is not installed/);
 } finally {cleanup(root);}
});
