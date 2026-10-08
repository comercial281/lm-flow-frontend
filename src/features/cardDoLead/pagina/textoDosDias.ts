// src/features/cardDoLead/pagina/textoDosDias.ts
// Texto dos dias embaixo de cada etapa da faixa (os dias vêm do servidor,
// PipelineItems::StageDurations; a tela só escreve).
import { plural } from '@/lib/formato';
import type { StageDuration } from '@/types/analytics';

export function textoDosDias(d?: StageDuration): string {
  if (!d) return '';
  return d.days < 1 ? 'menos de 1 dia' : plural(d.days, 'dia', 'dias');
}
