import { describe, expect, it } from 'vitest';
import {
  compareRklbRankFactors,
  countSupportedRankingCriteria,
} from '../../src/lib/rklb-ranking';

const scaleOnly = [
  { id: 'scale', status: 'supported' },
  { id: 'growth', status: 'uncertain' },
];
const nonScaleEvidence = [
  { id: 'scale', status: 'uncertain' },
  { id: 'growth', status: 'supported' },
];

describe('scaleCriterion ranking-bias regression', () => {
  it('shows the exact old-versus-new supported-count behavior', () => {
    const legacyCount = scaleOnly.filter((criterion) => criterion.status === 'supported').length;

    expect(legacyCount).toBe(1);
    expect(countSupportedRankingCriteria(scaleOnly)).toBe(0);
    expect(countSupportedRankingCriteria(nonScaleEvidence)).toBe(1);
  });

  it('removes the former ranking win caused only by supported scale evidence', () => {
    const oldScaleBiased = {
      ticker: 'SCALE_ONLY', supportedCriteriaCount: 1, catalystTier: 1,
      growthScore: 70, coverageScore: 70, healthScore: 70,
    };
    const strongerEvidence = {
      ticker: 'STRONGER', supportedCriteriaCount: 0, catalystTier: 4,
      growthScore: 95, coverageScore: 95, healthScore: 95,
    };
    expect(compareRklbRankFactors(oldScaleBiased, strongerEvidence)).toBeLessThan(0);

    const newScaleNeutral = {
      ...oldScaleBiased,
      supportedCriteriaCount: countSupportedRankingCriteria(scaleOnly),
    };
    expect(compareRklbRankFactors(newScaleNeutral, strongerEvidence)).toBeGreaterThan(0);
  });

  it('keeps scale in the evidence array while excluding only its ranking count', () => {
    expect(scaleOnly).toContainEqual({ id: 'scale', status: 'supported' });
    expect(countSupportedRankingCriteria(scaleOnly)).toBe(0);
  });
});
