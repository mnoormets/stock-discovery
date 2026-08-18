"use strict";exports.id=447,exports.ids=[447],exports.modules={8447:(e,t,a)=>{a.d(t,{Ew:()=>m,Ts:()=>o,ff:()=>c,ps:()=>_,qG:()=>u,t7:()=>l,wH:()=>s});var n=a(4770),r=a(5748),i=a(7865);let c="rklb-discovery-v2",s="SPY",o=["1w","2w","1m","3m","6m"],l="rklb_daily";async function u(e,t,a=new Date,i="rklb",u=null){await (0,r.aj)();let _=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Tallinn",year:"numeric",month:"2-digit",day:"2-digit"}).format(a),d=function(e,t){let a=function e(t){return Array.isArray(t)?t.map(e):t&&"object"==typeof t?Object.fromEntries(Object.entries(t).sort(([e],[t])=>e.localeCompare(t)).map(([t,a])=>[t,e(a)])):t}({rules:e,decisions:[...t].sort((e,t)=>e.ticker.localeCompare(t.ticker))});return(0,n.createHash)("sha256").update(JSON.stringify(a)).digest("hex")}(e,t),m="rklb_daily"===i?`${c}:${i}:${_}`:`${c}:${_}:${d}`,p=t.map(e=>e.ticker).sort(),y=t.filter(e=>e.included).length,h=i===l,b=h&&null!=u?u:null;if(null!=b&&(!Number.isInteger(b)||b<=0))throw Error("collectionRunId peab olema positiivne t\xe4isarv.");let S=await r.d_.connect();try{await S.query("BEGIN");let n=await S.query(`INSERT INTO discovery_runs
        (run_type, decision_date, run_at, model_version, input_hash, run_key, rules, universe,
         evaluated_count, included_count, collection_run_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)
       ON CONFLICT (run_key) DO NOTHING
       RETURNING id`,[i,_,a.toISOString(),c,d,m,JSON.stringify(e),JSON.stringify(p),t.length,y,b]),r=!!n.rowCount,u=r?Number(n.rows[0].id):0,g=t.length,N=y,w=d,v=b;if(!r){let e=await S.query(`SELECT id, evaluated_count, included_count, input_hash, collection_run_id
         FROM discovery_runs WHERE run_key = $1`,[m]);u=Number(e.rows[0].id),g=Number(e.rows[0].evaluated_count),N=Number(e.rows[0].included_count),w=String(e.rows[0].input_hash),v=null==e.rows[0].collection_run_id?null:Number(e.rows[0].collection_run_id)}if(r){let e=h?await S.query(`SELECT p.price, p.captured_at
             FROM price_snapshots p
             JOIN companies c ON c.id = p.company_id
             WHERE c.ticker = $1 AND p.price IS NOT NULL
               AND p.captured_at <= $2
               AND p.captured_at >= $2::timestamptz - interval '7 days'
             ORDER BY p.captured_at DESC, p.id DESC LIMIT 1`,[s,a.toISOString()]):null,n=e?.rows[0]||null;for(let e of t){let t=null==b?null:await S.query(`SELECT id FROM collection_run_items
               WHERE collection_run_id = $1 AND ticker = $2`,[b,e.ticker.trim().toUpperCase()]),r=t?.rows[0]?Number(t.rows[0].id):null,c=await S.query(`INSERT INTO discovery_decisions
            (run_id, company_id, ticker, included, candidate_rank, exclusion_reasons,
             growth_score, health_score, coverage_score, decision_price, currency,
             market_cap, volume, price_snapshot_id, score_snapshot_id, scoring_version,
             runway_status, runway_detail, catalyst_status, catalyst_type,
             catalyst_source_id, catalyst_url, catalyst_at, catalyst_detail,
             risks, unknowns, reasons, criteria, proof_questions,
             sector, industry, sector_group_type,
             sector_growth_percentile, sector_health_percentile,
             sector_coverage_percentile, sector_market_cap_percentile,
             sector_comparable_count, sector_median_growth,
             sector_median_health, sector_median_coverage, payload,
             catalyst_assessment_version, catalyst_evidence_status, catalyst_evidence_tier,
             catalyst_event_kind, catalyst_source_kind, catalyst_materiality,
             catalyst_materiality_ratio, catalyst_direction, catalyst_novelty,
             catalyst_thesis_relevance, catalyst_mandate_relevance,
             catalyst_evidence_freshness, catalyst_event_id,
             catalyst_linked_period_end, catalyst_next_scheduled_at,
             collection_run_item_id, analysis_scope)
           VALUES
            ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
             $17,$18,$19,$20,$21,$22,$23,$24,$25::jsonb,$26::jsonb,$27::jsonb,
             $28::jsonb,$29::jsonb,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,
             $41::jsonb,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,$54,$55,$56,$57,$58)
           RETURNING id`,[u,e.companyId,e.ticker,e.included,e.candidateRank,JSON.stringify(e.exclusionReasons),e.growthScore,e.healthScore,e.coverageScore,e.decisionPrice,e.currency,e.marketCap,e.volume,e.priceSnapshotId,e.scoreSnapshotId,e.scoringVersion,e.runwayStatus,e.runwayDetail,e.catalystStatus,e.catalystType,e.catalystSourceId,e.catalystUrl,e.catalystAt,e.catalystDetail,JSON.stringify(e.risks),JSON.stringify(e.unknowns),JSON.stringify(e.reasons),JSON.stringify(e.criteria),JSON.stringify(e.proofQuestions),e.sector,e.industry,e.sectorGroupType,e.sectorGrowthPercentile,e.sectorHealthPercentile,e.sectorCoveragePercentile,e.sectorMarketCapPercentile,e.sectorComparableCount,e.sectorMedianGrowth,e.sectorMedianHealth,e.sectorMedianCoverage,JSON.stringify(e),e.catalystAssessmentVersion,e.catalystEvidenceStatus,e.catalystEvidenceTier,e.catalystEventKind,e.catalystSourceKind,e.catalystMateriality,e.catalystMaterialityRatio,e.catalystDirection,e.catalystNovelty,e.catalystThesisRelevance,e.catalystMandateRelevance,e.catalystEvidenceFreshness,e.catalystEventId,e.catalystLinkedPeriodEnd,e.catalystNextScheduledAt,r,i===l?"canonical":"manual"]);if(h&&e.included){let e=Number(c.rows[0].id);for(let t of o)await S.query(`INSERT INTO candidate_outcomes
                (decision_id, horizon, target_at, benchmark_symbol,
                 benchmark_start_at, benchmark_price_start)
               VALUES ($1, $2, $3, $4, $5, $6)`,[e,t,(function(e,t){let a=new Date(e);"1w"===t&&a.setUTCDate(a.getUTCDate()+7),"2w"===t&&a.setUTCDate(a.getUTCDate()+14);let n="1m"===t?1:"3m"===t?3:"6m"===t?6:0;if(n){let e=a.getUTCDate();a.setUTCDate(1),a.setUTCMonth(a.getUTCMonth()+n);let t=new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth()+1,0)).getUTCDate();a.setUTCDate(Math.min(e,t))}return a})(a,t).toISOString(),s,n?.captured_at?new Date(n.captured_at).toISOString():null,n?.price==null?null:Number(n.price)])}}}return await S.query("COMMIT"),{runId:u,collectionRunId:v,created:r,decisionDate:_,evaluatedCount:g,includedCount:N,inputChangedAfterCanonicalSnapshot:!r&&w!==d}}catch(e){throw await S.query("ROLLBACK"),e}finally{S.release()}}async function _(e=new Date){await (0,r.aj)();let t=await r.d_.query(`SELECT o.id, o.target_at, d.company_id, d.decision_price
     FROM candidate_outcomes o
     JOIN discovery_decisions d ON d.id = o.decision_id
     WHERE o.status <> 'measured' AND o.target_at <= $1
     ORDER BY o.target_at, o.id`,[e.toISOString()]),a=0;for(let n of t.rows){let t=Number(n.id),i=null==n.decision_price?null:Number(n.decision_price);if(null==i||i<=0||null==n.company_id){a+=(await r.d_.query(`UPDATE candidate_outcomes SET status = 'unavailable', measured_at = $2
         WHERE id = $1 AND status <> 'measured'`,[t,e.toISOString()])).rowCount||0;continue}let c=await r.d_.query(`SELECT price, captured_at
       FROM price_snapshots
       WHERE company_id = $1 AND price IS NOT NULL
         AND captured_at >= $2 AND captured_at < $2::timestamptz + interval '7 days'
       ORDER BY captured_at ASC, id ASC LIMIT 1`,[Number(n.company_id),new Date(n.target_at).toISOString()]);if(c.rowCount){let n=Number(c.rows[0].price),s=(n-i)/i*100;a+=(await r.d_.query(`UPDATE candidate_outcomes
         SET status = 'measured', observed_at = $2, observed_price = $3,
             return_percent = $4, measured_at = $5
         WHERE id = $1 AND status <> 'measured'`,[t,new Date(c.rows[0].captured_at).toISOString(),n,s,e.toISOString()])).rowCount||0}else e.getTime()>=new Date(n.target_at).getTime()+6048e5&&(a+=(await r.d_.query(`UPDATE candidate_outcomes SET status = 'missing', measured_at = $2
         WHERE id = $1 AND status <> 'measured'`,[t,e.toISOString()])).rowCount||0)}for(let t of(await r.d_.query(`SELECT o.id, o.target_at, o.return_percent, o.benchmark_symbol,
            o.benchmark_price_start, o.benchmark_start_at, r.run_at
     FROM candidate_outcomes o
     JOIN discovery_decisions d ON d.id = o.decision_id
     JOIN discovery_runs r ON r.id = d.run_id
     WHERE o.status = 'measured'
       AND o.benchmark_status <> 'measured'
       AND o.target_at <= $1
     ORDER BY o.target_at, o.id`,[e.toISOString()])).rows){let n=t.benchmark_symbol||s,i=null==t.benchmark_price_start?null:Number(t.benchmark_price_start),c=t.benchmark_start_at?new Date(t.benchmark_start_at).toISOString():null;if(null==i||i<=0){let e=await r.d_.query(`SELECT p.price, p.captured_at
         FROM price_snapshots p
         JOIN companies c ON c.id = p.company_id
         WHERE c.ticker = $1 AND p.price IS NOT NULL
           AND p.captured_at <= $2
           AND p.captured_at >= $2::timestamptz - interval '7 days'
         ORDER BY p.captured_at DESC, p.id DESC LIMIT 1`,[n,new Date(t.run_at).toISOString()]);e.rowCount&&(i=Number(e.rows[0].price),c=new Date(e.rows[0].captured_at).toISOString())}let o=await r.d_.query(`SELECT p.price, p.captured_at
       FROM price_snapshots p
       JOIN companies c ON c.id = p.company_id
       WHERE c.ticker = $1 AND p.price IS NOT NULL
         AND p.captured_at >= $2
         AND p.captured_at < $2::timestamptz + interval '7 days'
       ORDER BY p.captured_at ASC, p.id ASC LIMIT 1`,[n,new Date(t.target_at).toISOString()]);if(null!=i&&i>0&&o.rowCount){let e=Number(o.rows[0].price),n=(e-i)/i*100,s=Number(t.return_percent);a+=(await r.d_.query(`UPDATE candidate_outcomes
         SET benchmark_status = 'measured', benchmark_start_at = $2,
             benchmark_end_at = $3, benchmark_price_start = $4,
             benchmark_price_end = $5, benchmark_return_percent = $6,
             excess_return_percent = $7
         WHERE id = $1 AND benchmark_status <> 'measured'`,[Number(t.id),c,new Date(o.rows[0].captured_at).toISOString(),i,e,n,s-n])).rowCount||0}else e.getTime()>=new Date(t.target_at).getTime()+6048e5&&(a+=(await r.d_.query(`UPDATE candidate_outcomes
         SET benchmark_status = 'missing',
             benchmark_start_at = COALESCE(benchmark_start_at, $2),
             benchmark_price_start = COALESCE(benchmark_price_start, $3)
         WHERE id = $1 AND benchmark_status <> 'measured'`,[Number(t.id),c,i])).rowCount||0)}return await (0,i.Uu)(),a}function d(e){return Array.isArray(e)?e:"string"==typeof e?JSON.parse(e):[]}async function m(){await (0,r.aj)(),await _();let[e,t,a,n,i]=await Promise.all([r.d_.query("SELECT count(*)::int AS runs, COALESCE(sum(included_count), 0)::int AS candidates FROM discovery_runs"),r.d_.query(`SELECT count(*)::int AS runs, COALESCE(sum(included_count), 0)::int AS candidates
       FROM discovery_runs WHERE run_type = $1`,[l]),r.d_.query(`SELECT model_version, run_type, count(*)::int AS runs,
              COALESCE(sum(included_count), 0)::int AS candidates
       FROM discovery_runs GROUP BY model_version, run_type
       ORDER BY model_version DESC, run_type`),r.d_.query(`SELECT o.horizon, o.status, o.return_percent, d.ticker
       FROM candidate_outcomes o
       JOIN discovery_decisions d ON d.id = o.decision_id
       JOIN discovery_runs r ON r.id = d.run_id
       WHERE r.run_type = $1`,[l]),r.d_.query(`SELECT id, decision_date, run_at, model_version, evaluated_count, included_count, rules
       FROM discovery_runs ORDER BY run_at DESC, id DESC LIMIT 20`)]),c=o.map(e=>{let t=n.rows.filter(t=>t.horizon===e),a=t.filter(e=>"measured"===e.status&&null!=e.return_percent).map(e=>({ticker:String(e.ticker),returnPercent:Number(e.return_percent)})),r=a.map(e=>e.returnPercent),i=r.filter(e=>e>0).length,c=r.filter(e=>e<0).length,s=r.filter(e=>0===e).length,o=[...a].sort((e,t)=>t.returnPercent-e.returnPercent);return{horizon:e,candidateCount:t.length,observedCount:a.length,pendingCount:t.filter(e=>"measured"!==e.status).length,averageReturn:r.length?r.reduce((e,t)=>e+t,0)/r.length:null,medianReturn:function(e){if(!e.length)return null;let t=[...e].sort((e,t)=>e-t),a=Math.floor(t.length/2);return t.length%2?t[a]:(t[a-1]+t[a])/2}(r),winnerCount:i,loserCount:c,flatCount:s,winnerPercent:r.length?i/r.length*100:null,loserPercent:r.length?c/r.length*100:null,best:o[0]||null,worst:o.length?o[o.length-1]:null}}),u=[];for(let e of i.rows){let t=await r.d_.query(`SELECT d.*,
        COALESCE(json_agg(json_build_object(
          'horizon', o.horizon, 'status', o.status, 'targetAt', o.target_at,
          'observedAt', o.observed_at, 'observedPrice', o.observed_price,
          'returnPercent', o.return_percent, 'benchmarkSymbol', o.benchmark_symbol,
          'benchmarkStatus', o.benchmark_status,
          'benchmarkPriceStart', o.benchmark_price_start,
          'benchmarkPriceEnd', o.benchmark_price_end,
          'benchmarkReturnPercent', o.benchmark_return_percent,
          'excessReturnPercent', o.excess_return_percent
        ) ORDER BY CASE o.horizon WHEN '1w' THEN 1 WHEN '2w' THEN 2 WHEN '1m' THEN 3 WHEN '3m' THEN 4 ELSE 5 END)
        FILTER (WHERE o.id IS NOT NULL), '[]'::json) AS outcomes
       FROM discovery_decisions d
       LEFT JOIN candidate_outcomes o ON o.decision_id = d.id
       WHERE d.run_id = $1
       GROUP BY d.id
       ORDER BY d.included DESC, d.candidate_rank NULLS LAST, d.ticker`,[Number(e.id)]);u.push({id:Number(e.id),decisionDate:String(e.decision_date).slice(0,10),runAt:new Date(e.run_at).toISOString(),modelVersion:e.model_version,evaluatedCount:Number(e.evaluated_count),includedCount:Number(e.included_count),rules:d(e.rules),decisions:t.rows.map(e=>({id:Number(e.id),companyId:null==e.company_id?0:Number(e.company_id),ticker:e.ticker,included:e.included,candidateRank:null==e.candidate_rank?null:Number(e.candidate_rank),exclusionReasons:d(e.exclusion_reasons),growthScore:null==e.growth_score?null:Number(e.growth_score),healthScore:null==e.health_score?null:Number(e.health_score),coverageScore:Number(e.coverage_score),decisionPrice:null==e.decision_price?null:Number(e.decision_price),currency:e.currency||null,marketCap:null==e.market_cap?null:Number(e.market_cap),volume:null==e.volume?null:Number(e.volume),priceSnapshotId:null==e.price_snapshot_id?null:Number(e.price_snapshot_id),scoreSnapshotId:null==e.score_snapshot_id?null:Number(e.score_snapshot_id),scoringVersion:e.scoring_version||null,runwayStatus:e.runway_status,runwayDetail:e.runway_detail,catalystStatus:e.catalyst_status,catalystType:e.catalyst_type||null,catalystSourceId:e.catalyst_source_id||null,catalystUrl:e.catalyst_url||null,catalystAt:e.catalyst_at?new Date(e.catalyst_at).toISOString():null,catalystDetail:e.catalyst_detail,catalystAssessmentVersion:e.catalyst_assessment_version||null,catalystEvidenceStatus:e.catalyst_evidence_status||null,catalystEvidenceTier:null==e.catalyst_evidence_tier?null:Number(e.catalyst_evidence_tier),catalystEventKind:e.catalyst_event_kind||null,catalystSourceKind:e.catalyst_source_kind||null,catalystMateriality:e.catalyst_materiality||null,catalystMaterialityRatio:null==e.catalyst_materiality_ratio?null:Number(e.catalyst_materiality_ratio),catalystDirection:e.catalyst_direction||null,catalystNovelty:e.catalyst_novelty||null,catalystThesisRelevance:e.catalyst_thesis_relevance||null,catalystMandateRelevance:e.catalyst_mandate_relevance||null,catalystEvidenceFreshness:e.catalyst_evidence_freshness||null,catalystEventId:null==e.catalyst_event_id?null:Number(e.catalyst_event_id),catalystLinkedPeriodEnd:e.catalyst_linked_period_end?String(e.catalyst_linked_period_end).slice(0,10):null,catalystNextScheduledAt:e.catalyst_next_scheduled_at?new Date(e.catalyst_next_scheduled_at).toISOString():null,risks:d(e.risks),unknowns:d(e.unknowns),reasons:d(e.reasons),criteria:d(e.criteria),proofQuestions:d(e.proof_questions),sector:e.sector||null,industry:e.industry||null,sectorGroupType:e.sector_group_type||null,sectorGrowthPercentile:null==e.sector_growth_percentile?null:Number(e.sector_growth_percentile),sectorHealthPercentile:null==e.sector_health_percentile?null:Number(e.sector_health_percentile),sectorCoveragePercentile:null==e.sector_coverage_percentile?null:Number(e.sector_coverage_percentile),sectorMarketCapPercentile:null==e.sector_market_cap_percentile?null:Number(e.sector_market_cap_percentile),sectorComparableCount:null==e.sector_comparable_count?null:Number(e.sector_comparable_count),sectorMedianGrowth:null==e.sector_median_growth?null:Number(e.sector_median_growth),sectorMedianHealth:null==e.sector_median_health?null:Number(e.sector_median_health),sectorMedianCoverage:null==e.sector_median_coverage?null:Number(e.sector_median_coverage),outcomes:d(e.outcomes).map(e=>({horizon:e.horizon,status:e.status,targetAt:new Date(e.targetAt).toISOString(),observedAt:e.observedAt?new Date(e.observedAt).toISOString():null,observedPrice:null==e.observedPrice?null:Number(e.observedPrice),returnPercent:null==e.returnPercent?null:Number(e.returnPercent),benchmarkSymbol:String(e.benchmarkSymbol||s),benchmarkStatus:e.benchmarkStatus||"pending",benchmarkPriceStart:null==e.benchmarkPriceStart?null:Number(e.benchmarkPriceStart),benchmarkPriceEnd:null==e.benchmarkPriceEnd?null:Number(e.benchmarkPriceEnd),benchmarkReturnPercent:null==e.benchmarkReturnPercent?null:Number(e.benchmarkReturnPercent),excessReturnPercent:null==e.excessReturnPercent?null:Number(e.excessReturnPercent)}))}))})}return{totalRuns:Number(e.rows[0]?.runs||0),totalCandidates:Number(e.rows[0]?.candidates||0),canonicalRuns:Number(t.rows[0]?.runs||0),canonicalCandidates:Number(t.rows[0]?.candidates||0),provenance:a.rows.map(e=>({modelVersion:String(e.model_version),runType:String(e.run_type),runs:Number(e.runs),candidates:Number(e.candidates)})),horizons:c,runs:u}}},7865:(e,t,a)=>{a.d(t,{Uu:()=>m,Xc:()=>r});var n=a(5748);let r="outcome-analysis-snapshot-v1";function i(e){if(null==e)return null;let t=Number(e);return Number.isFinite(t)?t:null}function c(e,t){let a=i(e),n=i(t);return null==a||null==n||n<=0?null:a/n*100}function s(e){return e&&"object"==typeof e&&!Array.isArray(e)?e:{}}function o(e){return Array.isArray(e)?e:[]}function l(e){return{id:Number(e.id),outcomeId:Number(e.outcome_id),decisionId:Number(e.decision_id),collectionRunItemId:null==e.collection_run_item_id?null:Number(e.collection_run_item_id),dataQualitySnapshotId:null==e.data_quality_snapshot_id?null:Number(e.data_quality_snapshot_id),snapshotVersion:String(e.snapshot_version),capturedAt:new Date(e.captured_at).toISOString(),ticker:String(e.ticker),horizon:String(e.horizon),decisionScope:e.decision_scope,candidateReturnPercent:i(e.candidate_return_percent),winnerStatus:e.winner_status,benchmarkReturnPercent:i(e.benchmark_return_percent),excessReturnPercent:i(e.excess_return_percent),benchmarkBeatStatus:e.benchmark_beat_status,growthScore:i(e.growth_score),coverageScore:i(e.coverage_score),lookupBucket:e.lookup_bucket,marketDataAttempted:null==e.market_data_attempted?null:!!e.market_data_attempted,marketDataFound:null==e.market_data_found?null:!!e.market_data_found,marketDataSource:e.market_data_source||null,catalystEvidenceTier:null==e.catalyst_evidence_tier?null:Number(e.catalyst_evidence_tier),catalystMandateRelevance:String(e.catalyst_mandate_relevance),dataQualityStatus:e.data_quality_status,secFactsCoveragePercent:i(e.sec_facts_coverage_percent),scoreCoveragePercent:i(e.score_coverage_percent),recentPriceCoveragePercent:i(e.recent_price_coverage_percent),staleFinancialsPercent:i(e.stale_financials_percent),missingFinancialsPercent:i(e.missing_financials_percent),lowCoveragePercent:i(e.low_coverage_percent),dataQualityMetrics:s(e.data_quality_metrics),warnings:o(e.warnings).map(String)}}async function u(e){if(!Number.isInteger(e)||e<=0)throw Error("outcomeId peab olema positiivne t\xe4isarv.");let{rows:t}=await n.d_.query(`SELECT
       o.id AS outcome_id, o.decision_id, o.horizon, o.status,
       o.return_percent, o.benchmark_return_percent, o.excess_return_percent,
       d.ticker, d.analysis_scope, d.growth_score, d.coverage_score,
       d.catalyst_evidence_tier, d.catalyst_mandate_relevance,
       d.collection_run_item_id,
       i.lookup_bucket, i.market_data_attempted, i.market_data_found, i.market_data_source,
       q.id AS data_quality_snapshot_id, q.snapshot_version AS data_quality_snapshot_version,
       q.evaluated_count AS quality_evaluated_count,
       q.companies_total AS quality_companies_total,
       q.companies_with_sec_facts, q.companies_with_scores,
       q.companies_with_recent_price, q.stale_financials_count,
       q.missing_financials_count, q.missing_price_count, q.missing_sector_count,
       q.low_coverage_count, q.metrics AS quality_metrics, q.warnings AS quality_warnings
     FROM candidate_outcomes o
     JOIN discovery_decisions d ON d.id = o.decision_id
     LEFT JOIN collection_run_items i ON i.id = d.collection_run_item_id
     LEFT JOIN data_quality_snapshots q ON q.run_id = d.run_id
     WHERE o.id = $1`,[e]),a=t[0];if(!a)throw Error(`Candidate outcome #${e} ei leitud.`);if("measured"!==a.status)throw Error(`Candidate outcome #${e} ei ole measured.`);let l=i(a.return_percent),u=i(a.benchmark_return_percent),_=i(a.excess_return_percent),d=null!=a.data_quality_snapshot_id,m=null!=a.collection_run_item_id&&null!=a.lookup_bucket,p=[];m||p.push("collection_provenance_unknown"),d||p.push("data_quality_unknown"),null==a.catalyst_evidence_tier&&p.push("catalyst_tier_unknown"),a.catalyst_mandate_relevance||p.push("mandate_relevance_unknown"),null==_&&p.push("benchmark_beat_unknown");let y=d?{snapshotVersion:a.data_quality_snapshot_version,evaluatedCount:Number(a.quality_evaluated_count),companiesTotal:Number(a.quality_companies_total),companiesWithSecFacts:Number(a.companies_with_sec_facts),companiesWithScores:Number(a.companies_with_scores),companiesWithRecentPrice:Number(a.companies_with_recent_price),staleFinancialsCount:Number(a.stale_financials_count),missingFinancialsCount:Number(a.missing_financials_count),missingPriceCount:Number(a.missing_price_count),missingSectorCount:Number(a.missing_sector_count),lowCoverageCount:Number(a.low_coverage_count),metrics:s(a.quality_metrics),sourceWarnings:o(a.quality_warnings)}:{};return{outcomeId:Number(a.outcome_id),decisionId:Number(a.decision_id),collectionRunItemId:m?Number(a.collection_run_item_id):null,dataQualitySnapshotId:d?Number(a.data_quality_snapshot_id):null,snapshotVersion:r,ticker:String(a.ticker),horizon:String(a.horizon),decisionScope:a.analysis_scope||"unknown",candidateReturnPercent:l,winnerStatus:null==l?"unknown":l>0?"winner":"not_winner",benchmarkReturnPercent:u,excessReturnPercent:_,benchmarkBeatStatus:null==_?"unknown":_>0?"beat":"not_beat",growthScore:i(a.growth_score),coverageScore:i(a.coverage_score),lookupBucket:m?a.lookup_bucket:"unknown",marketDataAttempted:m?!!a.market_data_attempted:null,marketDataFound:m?!!a.market_data_found:null,marketDataSource:m&&a.market_data_source||null,catalystEvidenceTier:null==a.catalyst_evidence_tier?null:Number(a.catalyst_evidence_tier),catalystMandateRelevance:a.catalyst_mandate_relevance||"unknown",dataQualityStatus:d?"available":"unknown",secFactsCoveragePercent:d?c(a.companies_with_sec_facts,a.quality_companies_total):null,scoreCoveragePercent:d?c(a.companies_with_scores,a.quality_companies_total):null,recentPriceCoveragePercent:d?c(a.companies_with_recent_price,a.quality_companies_total):null,staleFinancialsPercent:d?c(a.stale_financials_count,a.quality_companies_total):null,missingFinancialsPercent:d?c(a.missing_financials_count,a.quality_companies_total):null,lowCoveragePercent:d?c(a.low_coverage_count,a.quality_evaluated_count):null,dataQualityMetrics:y,warnings:p}}async function _(e){let{rows:t}=await n.d_.query("SELECT * FROM outcome_analysis_snapshots WHERE outcome_id = $1",[e]);return t[0]?l(t[0]):null}async function d(e){let t=await _(e);if(t){if(t.snapshotVersion!==r)throw Error(`Outcome #${e} snapshot on juba versiooniga ${t.snapshotVersion}; vaikne overwrite on keelatud.`);return t}let a=await u(e),i=[a.outcomeId,a.decisionId,a.collectionRunItemId,a.dataQualitySnapshotId,a.snapshotVersion,a.ticker,a.horizon,a.decisionScope,a.candidateReturnPercent,a.winnerStatus,a.benchmarkReturnPercent,a.excessReturnPercent,a.benchmarkBeatStatus,a.growthScore,a.coverageScore,a.lookupBucket,a.marketDataAttempted,a.marketDataFound,a.marketDataSource,a.catalystEvidenceTier,a.catalystMandateRelevance,a.dataQualityStatus,a.secFactsCoveragePercent,a.scoreCoveragePercent,a.recentPriceCoveragePercent,a.staleFinancialsPercent,a.missingFinancialsPercent,a.lowCoveragePercent,JSON.stringify(a.dataQualityMetrics),JSON.stringify(a.warnings)],c=await n.d_.query(`INSERT INTO outcome_analysis_snapshots
      (outcome_id, decision_id, collection_run_item_id, data_quality_snapshot_id,
       snapshot_version, ticker, horizon, decision_scope, candidate_return_percent, winner_status,
       benchmark_return_percent, excess_return_percent, benchmark_beat_status,
       growth_score, coverage_score, lookup_bucket, market_data_attempted,
       market_data_found, market_data_source, catalyst_evidence_tier,
       catalyst_mandate_relevance, data_quality_status, sec_facts_coverage_percent,
       score_coverage_percent, recent_price_coverage_percent, stale_financials_percent,
       missing_financials_percent, low_coverage_percent, data_quality_metrics, warnings)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
       $21,$22,$23,$24,$25,$26,$27,$28,$29::jsonb,$30::jsonb)
     ON CONFLICT (outcome_id) DO NOTHING
     RETURNING *`,i);if(c.rows[0])return l(c.rows[0]);let s=await _(e);if(!s)throw Error(`Outcome #${e} snapshoti salvestamine eba\xf5nnestus.`);if(s.snapshotVersion!==r)throw Error(`Outcome #${e} snapshoti versioonikonflikt.`);return s}async function m(){let{rows:e}=await n.d_.query(`SELECT o.id
     FROM candidate_outcomes o
     LEFT JOIN outcome_analysis_snapshots s ON s.outcome_id = o.id
     WHERE o.status = 'measured' AND s.id IS NULL
     ORDER BY o.measured_at, o.id`),t=0;for(let a of e)await d(Number(a.id)),t+=1;return t}}};