import { numero, plural } from '@/lib/formato';
import { WEEKDAYS } from '@/components/schedule/scheduleWindows';
import type {
  RoletaBusinessHours,
  RoletaConfig,
  RoletaOriginKind,
  RoletaPhoneStatus,
} from '@/services/roletaConfig/roletaConfigService';

// Os textos da roleta nova, num lugar só e com spec. A página lê a roleta como
// FRASE ("Formulários "ZONA SUL" → 10 corretores na fila"), e as mesmas frases
// aparecem no cartão da lista e na página da roleta.

/** Prazo pra aceitar, nas opções da tela. Zero = sem prazo (a oferta não expira). */
export const PRAZOS_EM_MINUTOS = [5, 10, 15, 30, 60, 120, 0] as const;

/** "5 min" · "1 h" · "1 h 30 min" · "Sem prazo". */
export function prazoTexto(minutos: number | null | undefined): string {
  const m = Number(minutos ?? 0);
  if (!m || m <= 0) return 'Sem prazo';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const resto = m % 60;
  return resto ? `${h} h ${resto} min` : `${h} h`;
}

/** "10 min pra aceitar" · "Sem prazo pra aceitar". */
export function prazoFrase(minutos: number | null | undefined): string {
  return `${prazoTexto(minutos)} pra aceitar`;
}

/** "08:00" → "8h" · "08:30" → "8h30". */
export function horaCurta(hhmm: string): string {
  const [h, m] = (hhmm || '').split(':');
  const hora = String(Number(h));
  if (!h || hora === 'NaN') return hhmm;
  return m && m !== '00' ? `${hora}h${m}` : `${hora}h`;
}

/** Dias marcados, na ordem em que o gestor lê a escala (segunda primeiro). */
export function diasTexto(dias: number[] | undefined): string {
  const marcados = WEEKDAYS.filter(([d]) => (dias ?? []).includes(d));
  if (marcados.length === 0 || marcados.length === 7) return 'Todos os dias';
  const posicoes = marcados.map(([d]) => WEEKDAYS.findIndex(([x]) => x === d));
  const seguidos = posicoes.every((p, i) => i === 0 || p === posicoes[i - 1] + 1);
  if (seguidos && marcados.length >= 3) return `${marcados[0][1]} a ${marcados[marcados.length - 1][1]}`;
  return marcados.map(([, nome]) => nome).join(', ');
}

/** "24 horas" · "Seg a Sáb, 8h–20h" · várias faixas separadas por " · ". */
export function horarioTexto(h: RoletaBusinessHours | null | undefined): string {
  if (!h || h.mode !== 'custom' || !h.windows?.length) return '24 horas';
  return h.windows.map(w => `${diasTexto(w.days)}, ${horaCurta(w.start)}–${horaCurta(w.end)}`).join(' · ');
}

/** Quem está na fila e recebe (pausado fica na lista, mas é pulado). */
export function ativosNaFila(r: Pick<RoletaConfig, 'members'>): number {
  return (r.members ?? []).filter(m => m.is_active).length;
}

/** Linha do meio do cartão: de onde vem → quantos recebem. */
export function origensEFila(r: Pick<RoletaConfig, 'members' | 'origins_summary'>): string {
  const origens = (r.origins_summary ?? []).filter(Boolean);
  const de = origens.length ? origens.join(', ') : 'Sem origem ainda';
  const ativos = ativosNaFila(r);
  const fila = ativos ? plural(ativos, 'corretor na fila', 'corretores na fila') : 'ninguém na fila';
  return `${de} → ${fila}`;
}

/** A linha de atenção do cartão. Vazia quando não há nada (e aí ela some). */
export function atencaoTexto(r: Pick<RoletaConfig, 'pending_count' | 'exhausted_count_7d'>): string {
  const partes: string[] = [];
  const esperando = r.pending_count ?? 0;
  const ninguem = r.exhausted_count_7d ?? 0;
  if (esperando > 0) partes.push(`${numero(esperando)} esperando aceite`);
  if (ninguem > 0) partes.push(`${numero(ninguem)} ninguém aceitou`);
  return partes.join(' · ');
}

/**
 * O que falta pra roleta poder ligar (a chave fica travada com o motivo).
 * Vazio = pode ligar. O servidor confere de novo e recusa com a mesma frase.
 */
export function faltaParaLigar(origens: number, ativos: number): string {
  const falta: string[] = [];
  if (origens < 1) falta.push('uma origem');
  if (ativos < 1) falta.push('um corretor ativo na fila');
  return falta.length ? `Falta: ${falta.join(' e ')}` : '';
}

/** "1º", "2º"… */
export function posicaoTexto(indice: number): string {
  return `${indice + 1}º`;
}

/** Situação do número próprio do corretor na fila. */
export function numeroDoCorretor(phoneDisplay: string | null | undefined, status: RoletaPhoneStatus | null | undefined): string {
  if (!status || status === 'none' || !phoneDisplay) return 'sem número próprio';
  return `${phoneDisplay} · ${status === 'connected' ? 'conectado' : 'desconectado'}`;
}

/** O nome de cada tipo de origem, como aparece na linha e no "+ Adicionar origem". */
export const TIPO_DA_ORIGEM_LABELS: Record<RoletaOriginKind, string> = {
  meta_form: 'Formulário do Meta',
  meta_form_keyword: 'Formulário do Meta',
  sales_agent: 'IA Vendedora',
  landing: 'Landing',
  portal_sale: 'Portal',
  portal_rent: 'Portal',
  site_sale: 'Site',
  site_rent: 'Site',
};

/** "Formulário do Meta · "21/08 - ALMA"" · "Formulário do Meta · nome contém "ALMA"" · "Portal · ZAP (venda)". */
export function origemTexto(o: { kind: RoletaOriginKind; label: string }): string {
  const tipo = TIPO_DA_ORIGEM_LABELS[o.kind] ?? 'Origem';
  if (o.kind === 'meta_form') return `${tipo} · "${o.label}"`;
  if (o.kind === 'meta_form_keyword') return `${tipo} · nome contém "${o.label}"`;
  if (o.kind === 'portal_sale' || o.kind === 'site_sale') return `${tipo} · ${o.label} (venda)`;
  if (o.kind === 'portal_rent' || o.kind === 'site_rent') return `${tipo} · ${o.label} (locação)`;
  return `${tipo} · ${o.label}`;
}

/** Sem acento e em minúsculas, pra comparar a palavra do "nome contém" com o nome do formulário. */
export function semAcento(texto: string): string {
  return (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Os formulários que a palavra pega (prévia; quem decide de verdade é o servidor). */
export function formulariosQuePega<T extends { label: string }>(palavra: string, formularios: T[]): T[] {
  const p = semAcento(palavra);
  if (!p) return [];
  return formularios.filter(f => semAcento(f.label).includes(p));
}
