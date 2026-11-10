const path=require('node:path');const {loadTs,loadEnv,registerRepoModules}=require('./_ts-loader.cjs');
registerRepoModules(process.cwd());loadEnv(process.cwd());const {pool}=loadTs(path.resolve('src/lib/db.ts'));const {getOpportunityBook}=loadTs(path.resolve('src/lib/opportunity-book.ts'));
const {summarizeOpportunityResults}=loadTs(path.resolve('src/lib/opportunity-results.ts'));
getOpportunityBook().then(r=>console.log(JSON.stringify({...r,results:summarizeOpportunityResults(r.rows)},null,2))).catch(()=>{console.error('Read-only opportunity audit failed.');process.exitCode=1;}).finally(()=>pool.end());
