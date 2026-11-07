const fs = require('node:fs');
const path = require('node:path');
const allowed = { domain: ['domain'], application: ['domain','application'], infrastructure: ['domain','application','infrastructure'], presentation: ['domain','application','presentation'] };
function files(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]); }
let violations = [];
const graph = new Map();
for (const api of ['auth','game']) {
 const root = path.resolve(`apps/${api}-api/src`);
 for (const file of files(root).filter(f=>f.endsWith('.ts'))) {
  const layer = path.relative(root,file).split(path.sep)[0];
  const imports = [...fs.readFileSync(file,'utf8').matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)].map(m=>m[1]);
  const edges = [];
  for (const imp of imports) {
   if (imp.startsWith('.')) {
    const target = path.resolve(path.dirname(file),imp)+'.ts'; edges.push(target);
    const targetLayer = path.relative(root,target).split(path.sep)[0];
    if (allowed[layer] && !allowed[layer].includes(targetLayer) && !(layer === 'infrastructure' && imp === '../../generated/client')) violations.push(`${file}: forbidden layer ${imp}`);
    if (!target.startsWith(root+path.sep) && layer !== 'infrastructure') violations.push(`${file}: external source import ${imp}`);
   } else if (['domain','application'].includes(layer)) violations.push(`${file}: framework/external import ${imp}`);
   if (imp.includes('apps/') || imp.includes('game-api') || imp.includes('auth-api')) violations.push(`${file}: cross-service import`);
  }
  graph.set(file,edges);
 }
}
const active=new Set(),done=new Set();
function visit(file) { if(active.has(file)){violations.push(`Circular dependency: ${file}`);return;} if(done.has(file))return;active.add(file);for(const edge of graph.get(file)||[])visit(edge);active.delete(file);done.add(file); }
for(const file of graph.keys())visit(file);
if(violations.length) { console.error(violations.join('\n')); process.exitCode=1; } else console.log('NexQuiz architecture: layer boundaries and import cycles passed.');
