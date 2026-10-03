import { numero } from '@/lib/formato';
import type { CostCall } from '@/types/admin/costs';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "2026-10" → "outubro de 2026" */
export function rotuloMes(key: string): string {
  const [ano, mes] = key.split('-').map(Number);
  return `${MESES[(mes || 1) - 1]} de ${ano}`;
}

/** O "tamanho" da chamada, sem a palavra token na tela. */
export function tamanho(c: Pick<CostCall, 'input_tokens' | 'output_tokens' | 'cache_read_tokens' | 'cache_write_tokens' | 'audio_seconds' | 'characters' | 'units_estimated'>): string {
  if (c.audio_seconds != null) {
    const s = Math.round(c.audio_seconds);
    const txt = s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s de áudio` : `${s} s de áudio`;
    return c.units_estimated ? `${txt} (estimado)` : txt;
  }
  if (c.characters != null) return `${numero(c.characters)} caracteres`;
  const total = c.input_tokens + c.output_tokens + c.cache_read_tokens + c.cache_write_tokens;
  return numero(total);
}
