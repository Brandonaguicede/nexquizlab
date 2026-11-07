const path = require('node:path');
const { spawnSync } = require('node:child_process');
for (const service of ['auth','game']) {
 const result = spawnSync(process.execPath,[path.join(__dirname,'prisma.cjs'),service,'deploy'],{stdio:'inherit'});
 if (result.error || result.status !== 0) process.exit(1);
}

