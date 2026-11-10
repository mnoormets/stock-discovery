const fs=require('node:fs'),path=require('node:path');
const loader=require('./_ts-loader.cjs');loader.registerRepoModules(process.cwd());loader.loadEnv(process.cwd());
const {pool}=loader.loadTs(path.resolve('src/lib/db.ts'));
(async()=>{try{
 const args=process.argv.slice(2),value=key=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};
 const collection=value('--collection'),id=collection==null?undefined:Number(collection);
 if(id!=null&&(!Number.isSafeInteger(id)||id<=0))throw Error('Invalid collection ID');
 const api=loader.loadTs(path.resolve('src/lib/strategy-outcome-audit.ts'));
 const result=await (args.includes('--record')?api.recordStrategyCoverage:api.getStrategyCoverage)(id,value('--as-of'));
 const output=value('--output');if(output)fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 const r=result.report;console.log(JSON.stringify(r?{available:true,collectionId:r.collectionId,asOf:r.asOf,inventoryStatus:r.inventoryStatus,
   historicalAudit:r.historicalAudit,engineWarning:r.engineWarning,inventoryCount:r.inventoryCount,membershipRecords:r.membershipRecords,uniqueTickers:r.uniqueTickers,edgeAssessment:r.edgeAssessment,
   strategies:r.strategies.map(s=>({id:s.strategyId,versionHash:s.versionHash,reproducible:s.reproducible,all:s.groups[0],funnel:s.funnel,missingReasons:s.missingReasons})),output:output??null}
  :result,null,2));
}finally{await pool.end()}})().catch(e=>{console.error('Strategy coverage audit failed: '+e.name+' '+e.message.replace(/https?:\/\/\S+/g,'[URL]'));process.exitCode=1;});
