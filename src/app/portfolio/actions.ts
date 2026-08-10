'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createPosition, deletePosition, updatePosition, type PositionInput } from '@/lib/portfolio';

function inputFromForm(formData: FormData): PositionInput {
  return {
    ticker: String(formData.get('ticker') || ''),
    quantity: Number(formData.get('quantity')),
    averageBuyPrice: Number(formData.get('averageBuyPrice')),
    thesis: String(formData.get('thesis') || '').trim(),
    timeHorizon: String(formData.get('timeHorizon') || '').trim(),
    status: String(formData.get('status') || 'active') as PositionInput['status'],
    notes: String(formData.get('notes') || '').trim(),
  };
}

function finish(message: string) {
  revalidatePath('/portfolio');
  revalidatePath('/daily');
  redirect(`/portfolio?message=${encodeURIComponent(message)}`);
}

export async function createPositionAction(formData: FormData) {
  try {
    await createPosition(inputFromForm(formData));
  } catch (error) {
    redirect(`/portfolio?error=${encodeURIComponent((error as Error).message)}`);
  }
  finish('Positsioon lisatud.');
}

export async function updatePositionAction(formData: FormData) {
  const id = Number(formData.get('id'));
  if (!Number.isInteger(id) || id <= 0) redirect('/portfolio?error=Vigane%20positsiooni%20ID.');
  try {
    await updatePosition(id, inputFromForm(formData));
  } catch (error) {
    redirect(`/portfolio?error=${encodeURIComponent((error as Error).message)}`);
  }
  finish('Positsioon uuendatud.');
}

export async function deletePositionAction(formData: FormData) {
  const id = Number(formData.get('id'));
  if (!Number.isInteger(id) || id <= 0) redirect('/portfolio?error=Vigane%20positsiooni%20ID.');
  await deletePosition(id);
  finish('Positsioon eemaldatud.');
}
