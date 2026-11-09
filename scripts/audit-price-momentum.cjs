const path=require('node:path');const {loadTs,loadEnv,registerRepoModules}=require('./_ts-loader.cjs');
registerRepoModules(process.cwd());loadEnv(process.cwd());const {pool}=loadTs(path.resolve('src/lib/db.ts'));
const {getGrowthCohortReport}=loadTs(path.resolve('src/lib/growth-cohort.ts'));
getGrowthCohortReport(7,'priceMomentum').then(r=>console.log(JSON.stringify(r,null,2)))
.catch(()=>{console.error('Price momentum read-only audit failed.');process.exitCode=1;}).finally(()=>pool.end());
