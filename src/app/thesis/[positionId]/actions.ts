'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { saveThesisCard, type ThesisCardInput, type ThesisStatus } from '@/lib/thesis';

function field(formData: FormData, name: string): string {
  return String(formData.get(name) || '');
}

export async function saveThesisAction(formData: FormData) {
  const positionId = Number(formData.get('positionId'));
  const rawSnapshotId = Number(formData.get('scoreSnapshotId'));
  const input: ThesisCardInput = {
    summary: field(formData, 'summary'),
    business: field(formData, 'business'),
    whyNow: field(formData, 'whyNow'),
    moat: field(formData, 'moat'),
    mispricing: field(formData, 'mispricing'),
    catalyst: field(formData, 'catalyst'),
    invalidation: field(formData, 'invalidation'),
    twelveMonthCheckpoint: field(formData, 'twelveMonthCheckpoint'),
    checkpointIsMeasurable: formData.get('checkpointIsMeasurable') === 'on',
    revenueAssumption: field(formData, 'revenueAssumption'),
    marginAssumption: field(formData, 'marginAssumption'),
    cashFlowAssumption: field(formData, 'cashFlowAssumption'),
    dilutionAssumption: field(formData, 'dilutionAssumption'),
    valuationAssumption: field(formData, 'valuationAssumption'),
    downsideScenario: field(formData, 'downsideScenario'),
    reverseValuationQuestion: field(formData, 'reverseValuationQuestion'),
    nextReviewTrigger: field(formData, 'nextReviewTrigger'),
    timeHorizon: field(formData, 'timeHorizon'),
    status: field(formData, 'status') as ThesisStatus,
    scoreSnapshotId: Number.isInteger(rawSnapshotId) && rawSnapshotId > 0 ? rawSnapshotId : null,
    valuationPriceSnapshotId: (() => {
      const value = Number(formData.get('valuationPriceSnapshotId'));
      return Number.isInteger(value) && value > 0 ? value : null;
    })(),
  };

  let result: Awaited<ReturnType<typeof saveThesisCard>>;
  try {
    result = await saveThesisCard(positionId, input);
  } catch (error) {
    redirect(`/thesis/${positionId}?error=${encodeURIComponent((error as Error).message)}`);
  }
  revalidatePath(`/thesis/${positionId}`);
  revalidatePath('/watchlist');
  revalidatePath('/portfolio');
  revalidatePath('/daily');
  const message = result.created
    ? `Teesi versioon ${result.version} salvestatud.`
    : `Sisu ei muutunud; versioon ${result.version} jäi samaks.`;
  redirect(`/thesis/${positionId}?message=${encodeURIComponent(message)}`);
}
