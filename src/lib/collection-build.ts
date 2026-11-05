export function collectionBuildProvenance(env:Record<string,string|undefined>=process.env) {
  const revision=env.COLLECTION_BUILD_REVISION??env.GITHUB_SHA;
  return {version:'collection-build-v1',revision:revision&&/^[a-f0-9]{40}$/i.test(revision)?revision:null,
    runner:env.GITHUB_ACTIONS==='true'?'github_actions':'local_or_unknown',
    runId:env.GITHUB_RUN_ID&&/^\d{1,24}$/.test(env.GITHUB_RUN_ID)?env.GITHUB_RUN_ID:null,
    capabilities:['growth-trend-review-v1','listing-financial-assessment-v1','growth-cohort-v1']};
}
