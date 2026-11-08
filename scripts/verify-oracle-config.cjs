const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const root=process.cwd(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexquiz-oracle-compose-'));
try{
 for(const name of ['.env.example','pnpm-lock.yaml','docker-compose.prod.yml','docker-compose.oracle.yml'])fs.copyFileSync(path.join(root,name),path.join(dir,name));
 let r=spawnSync(process.execPath,[path.join(root,'scripts/setup-oracle.cjs'),'nexquiz-fixture.duckdns.org'],{cwd:dir,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);
 r=spawnSync('docker',['compose','--env-file','.env.oracle','-f','docker-compose.prod.yml','-f','docker-compose.oracle.yml','config','--format','json'],{cwd:dir,encoding:'utf8',maxBuffer:4*1024*1024,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot}});if(r.status!==0)throw Error(r.stderr);
 const c=JSON.parse(r.stdout);for(const name of ['auth-api','game-api','web','results-client']){if(c.services[name].platform!=='linux/arm64'||!c.services[name].build)throw Error(name+' build/platform');}
 for(const name of ['auth-api','game-api'])if(c.services[name].image!==c.services[name.replace('-api','-migrate')].image)throw Error('Migration image mismatch');
 for(const [name,s]of Object.entries(c.services))if(s.ports&&name!=='proxy'&&name!=='grafana')throw Error('Unexpected public ports: '+name);
 if(!c.services.grafana.ports.every(p=>p.host_ip==='127.0.0.1'))throw Error('Grafana exposed');
 if(!c.secrets.jwt_private.file.includes(path.join('secrets','oracle')))throw Error('Wrong secret path');
 console.log('PASS: Oracle Compose merges, ARM64 build targets, migration images, isolated secrets and private service ports.');
}finally{const target=path.resolve(dir);if(!target.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(target).startsWith('nexquiz-oracle-compose-'))throw Error('Invalid cleanup');fs.rmSync(target,{recursive:true,force:true});}
