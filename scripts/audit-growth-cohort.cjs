const path=require('node:path');const {loadTs,loadEnv,registerRepoModules}=require('./_ts-loader.cjs');
const root=path.resolve(__dirname,'..');registerRepoModules(root);loadEnv(root);
const {pool}=loadTs(path.join(root,'src/lib/db.ts'));const {getGrowthCohortReport}=loadTs(path.join(root,'src/lib/growth-cohort.ts'));
getGrowthCohortReport(Number(process.argv[2]??7)).then(r=>console.log(JSON.stringify(r,null,2)))
  .catch(()=>{console.error('Cohort audit failed.');process.exitCode=1;}).finally(()=>pool.end());
