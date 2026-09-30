// Datas no LM Flow chegam em formatos diferentes dependendo do serializer do
// backend: epoch em SEGUNDOS (ex.: created_at&.to_i), epoch em MILISSEGUNDOS,
// ou string ISO. Usar `new Date(segundos)` direto mostrava 21/01/1970.
//
// Desde a Fase 3 (30/09/2026) a leitura e o formato moram em `@/lib/formato`
// (um lugar só). Estes nomes continuam existindo porque 36 telas já os usam;
// eles só repassam.
import { toDate as lerData, data, dataHora } from '@/lib/formato';

export const toDate = lerData;

/** Data curta pt-BR (dd/mm/aaaa) ou '—' se inválida. */
export function formatDateBR(value: unknown): string {
  return data(value);
}

/** Data + hora pt-BR ("30/09/2026 às 14:32") ou '—' se inválida. */
export function formatDateTimeBR(value: unknown): string {
  return dataHora(value);
}
