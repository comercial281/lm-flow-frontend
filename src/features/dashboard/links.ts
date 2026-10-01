// src/features/dashboard/links.ts
import { dataCurta } from '@/lib/formato';

/**
 * Os links da Dashboard. Quem MONTA (a Dashboard) e quem LÊ (a tela de destino)
 * usam as funções daqui, então o número e a lista nunca discordam sobre o que o
 * link quer dizer. Os filtros que saem daqui são os que o servidor entende.
 */

export interface FiltroDoLink {
  /** O que o chip "Da Dashboard: …" escreve. */
  rotulo: string;
  /** Vai direto para a busca da lista. */
  params: Record<string, string>;
}

export interface FiltroAgenda extends FiltroDoLink {
  /** Abrir esta visita assim que a Agenda carregar. */
  visita: string | null;
}

export type RecorteImoveis =
  | 'ativos' | 'novos' | 'exclusivos' | 'com_placa' | 'sem_fotos' | 'fora_do_site' | 'desatualizados';

const RECORTES_IMOVEIS: Record<RecorteImoveis, FiltroDoLink> = {
  ativos:         { rotulo: 'Ativos',         params: { status: 'active' } },
  novos:          { rotulo: 'Novos',          params: {} },
  exclusivos:     { rotulo: 'Exclusivos',     params: { status: 'active', exclusive: '1' } },
  com_placa:      { rotulo: 'Com placa',      params: { status: 'active', on_sign: '1' } },
  sem_fotos:      { rotulo: 'Sem fotos',      params: { status: 'active', without_photos: '1' } },
  fora_do_site:   { rotulo: 'Fora do site',   params: { status: 'active', off_site: '1' } },
  desatualizados: { rotulo: 'Desatualizados', params: { status: 'active', stale: '1' } },
};

export type SituacaoAgenda = 'a_confirmar' | 'sem_feedback';

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const diaValido = (valor: string | null | undefined): string | null => (valor && DIA.test(valor) ? valor : null);

function query(pares: Record<string, string | null | undefined>): string {
  const sp = new URLSearchParams();
  Object.entries(pares).forEach(([chave, valor]) => {
    if (valor) sp.set(chave, valor);
  });
  const texto = sp.toString();
  return texto ? `?${texto}` : '';
}

function rotuloPeriodo(desde: string | null, ate: string | null): string {
  if (desde && ate) return `${dataCurta(desde)} a ${dataCurta(ate)}`;
  if (desde) return `desde ${dataCurta(desde)}`;
  if (ate) return `até ${dataCurta(ate)}`;
  return '';
}

// ── Imóveis ─────────────────────────────────────────────────────────────────
export function linkImoveis(recorte: RecorteImoveis, opcoes: { desde?: string; meus?: boolean } = {}): string {
  return `/properties${query({
    recorte,
    desde: recorte === 'novos' ? diaValido(opcoes.desde) : null,
    meus: opcoes.meus ? '1' : null,
  })}`;
}

export function lerRecorteImoveis(sp: URLSearchParams): FiltroDoLink | null {
  const recorte = sp.get('recorte');
  if (!recorte || !(recorte in RECORTES_IMOVEIS)) return null;
  const base = RECORTES_IMOVEIS[recorte as RecorteImoveis];
  const params = { ...base.params };
  const desde = diaValido(sp.get('desde'));
  if (recorte === 'novos' && desde) params.created_since = desde;
  const meus = sp.get('meus') === '1';
  if (meus) params.mine = '1';
  return { rotulo: meus ? `${base.rotulo} (seus)` : base.rotulo, params };
}

// ── Agenda ──────────────────────────────────────────────────────────────────
export function linkAgenda(
  opcoes: { desde?: string; ate?: string; situacao?: SituacaoAgenda; visita?: string } = {},
): string {
  return `/visits${query({
    situacao: opcoes.situacao,
    desde: diaValido(opcoes.desde),
    ate: diaValido(opcoes.ate),
    visita: opcoes.visita,
  })}`;
}

export function lerFiltroAgenda(sp: URLSearchParams): FiltroAgenda | null {
  const params: Record<string, string> = {};
  const partes: string[] = [];
  const situacao = sp.get('situacao');
  if (situacao === 'a_confirmar') {
    params.pending_confirmation = '1';
    partes.push('A confirmar');
  } else if (situacao === 'sem_feedback') {
    params.without_feedback = '1';
    partes.push('Sem feedback');
  }
  const desde = diaValido(sp.get('desde'));
  const ate = diaValido(sp.get('ate'));
  if (desde) params.since = desde;
  if (ate) params.until = ate;
  const periodo = rotuloPeriodo(desde, ate);
  if (periodo) partes.push(periodo);
  const visita = sp.get('visita');
  if (!partes.length && !visita) return null;
  return { rotulo: partes.join(' · '), params, visita };
}

// ── Propostas ───────────────────────────────────────────────────────────────
export function linkPropostas(opcoes: { desde?: string; ate?: string } = {}): string {
  return `/proposals${query({ desde: diaValido(opcoes.desde), ate: diaValido(opcoes.ate) })}`;
}

export function lerFiltroPropostas(sp: URLSearchParams): FiltroDoLink | null {
  const desde = diaValido(sp.get('desde'));
  const ate = diaValido(sp.get('ate'));
  if (!desde && !ate) return null;
  const params: Record<string, string> = {};
  if (desde) params.since = desde;
  if (ate) params.until = ate;
  return { rotulo: rotuloPeriodo(desde, ate), params };
}

// ── Funil, card, conversa, aceite ───────────────────────────────────────────
export function linkFunil(pipelineId: string, etapaId?: string): string {
  return `/pipelines/${pipelineId}${query({ etapa: etapaId })}`;
}

export function linkCard(pipelineId: string, itemId: string): string {
  return `/pipelines/${pipelineId}${query({ card: itemId })}`;
}

export function linkConversa(conversationId: string): string {
  return `/conversations/${conversationId}`;
}

export function linkAceite(ofertaId: string): string {
  return `/roleta/aceite/${ofertaId}`;
}
