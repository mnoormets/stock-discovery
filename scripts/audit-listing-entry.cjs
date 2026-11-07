const path=require('node:path');const {loadTs,loadEnv,registerRepoModules}=require('./_ts-loader.cjs');
const root=process.cwd();registerRepoModules(root);loadEnv(root);
const {pool}=loadTs(path.join(root,'src/lib/db.ts'));
const {getListingEntryEvaluation}=loadTs(path.join(root,'src/lib/listing-entry-evaluation.ts'));
getListingEntryEvaluation().then(report=>console.log(JSON.stringify(report,null,2)))
  .catch(()=>{console.error('Read-only listing entry evaluation failed.');process.exitCode=1;}).finally(()=>pool.end());
