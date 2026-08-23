// Datas no LM Flow chegam em formatos diferentes dependendo do serializer do
// backend: epoch em SEGUNDOS (ex.: created_at&.to_i), epoch em MILISSEGUNDOS,
// ou string ISO. Usar `new Date(segundos)` direto mostrava 21/01/1970.
// Estes helpers normalizam os 3 casos com segurança.

export function toDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    // < 1e12 = epoch em segundos (timestamps em ms são ~1.7e12). Multiplica.
    return new Date(value < 1e12 ? value * 1000 : value);
  }
  const s = String(value);
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return new Date(n < 1e12 ? n * 1000 : n);
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : null;
}

/** Data curta pt-BR (dd/mm/aaaa) ou '-' se inválida. */
export function formatDateBR(value: unknown): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString('pt-BR') : '-';
}

/** Data + hora pt-BR ou '-' se inválida. */
export function formatDateTimeBR(value: unknown): string {
  const d = toDate(value);
  return d ? d.toLocaleString('pt-BR') : '-';
}
