// One regular-session research snapshot per NY day; no canonical signals or trades.
const path=require('node:path');
const {loadTs,loadEnv,ensureLocalDatabaseUrl,repoRoot,registerRepoModules}=require('./_ts-loader.cjs');
const root=repoRoot();registerRepoModules(root);loadEnv(root);ensureLocalDatabaseUrl();
process.env.FMP_API_KEY=''; // Existing free sources only, including local runs with an optional key configured.
const {pool}=loadTs(path.join(root,'src/lib/db.ts'));
const {refreshSessionResearch}=loadTs(path.join(root,'src/lib/session-research.ts'));
refreshSessionResearch().then(result=>console.log(JSON.stringify(result)))
  .catch(()=>{console.error('Regular-session research refresh failed; inspect collection status.');process.exitCode=1;}).finally(()=>pool.end());
