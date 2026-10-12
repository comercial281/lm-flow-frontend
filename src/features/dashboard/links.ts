// src/features/dashboard/links.ts
import { dataCurta } from '@/lib/formato';
import { ABA_NA_URL } from '@/features/properties/listingKind';

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

/** O recorte de Imóveis pode levar lista (`stage[]` da fase). */
export interface FiltroImoveis {
  rotulo: string;
  params: Record<string, string | string[]>;
}

export type RecorteImoveis =
  | 'ativos' | 'novos' | 'exclusivos' | 'com_placa' | 'sem_fotos' | 'fora_do_site' | 'desatualizados'
  | 'na_planta' | 'em_obra' | 'prontos';

/** Fases: empreendimento ativo, sem período (frente 5 da Nova 27). Abrem na aba Empreendimentos. */
const RECORTES_DE_FASE: RecorteImoveis[] = ['na_planta', 'em_obra', 'prontos'];

/** Aba da Atividades que abriu a lista (f2-07): em que faixa os imóveis vencem. */
export type FaixaDeVencimento = 'para_fazer' | 'hoje' | 'amanha' | 'atrasadas' | 'semana' | 'proxima_semana';

const FAIXAS: Record<FaixaDeVencimento, string> = {
  para_fazer: 'vencidos até hoje',
  hoje: 'vencem hoje',
  amanha: 'vencem amanhã',
  atrasadas: 'venceram antes de hoje',
  semana: 'vencem esta semana',
  proxima_semana: 'vencem semana que vem',
};
// hasOwnProperty, não `in`: `in` aceitaria "toString" e outros nomes herdados do objeto.
const ehFaixa = (v: string | null): v is FaixaDeVencimento =>
  !!v && Object.prototype.hasOwnProperty.call(FAIXAS, v);

const RECORTES_IMOVEIS: Record<RecorteImoveis, FiltroImoveis> = {
  ativos:         { rotulo: 'Ativos',         params: { status: 'active' } },
  novos:          { rotulo: 'Novos',          params: {} },
  exclusivos:     { rotulo: 'Exclusivos',     params: { status: 'active', exclusive: '1' } },
  com_placa:      { rotulo: 'Com placa',      params: { status: 'active', on_sign: '1' } },
  sem_fotos:      { rotulo: 'Sem fotos',      params: { status: 'active', without_photos: '1' } },
  fora_do_site:   { rotulo: 'Fora do site',   params: { status: 'active', off_site: '1' } },
  desatualizados: { rotulo: 'Desatualizados', params: { status: 'active', stale: '1' } },
  // Pré-lançamento entra em "Na planta", como no número do Painel.
  na_planta:      { rotulo: 'Na planta',      params: { status: 'active', 'stage[]': ['pre_launch', 'launch'] } },
  em_obra:        { rotulo: 'Em obra',        params: { status: 'active', 'stage[]': ['in_construction'] } },
  prontos:        { rotulo: 'Prontos',        params: { status: 'active', 'stage[]': ['ready'] } },
};

export type SituacaoAgenda = 'a_confirmar' | 'sem_feedback' | 'realizadas';

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
export function linkImoveis(
  recorte: RecorteImoveis,
  opcoes: { desde?: string; ate?: string; meus?: boolean; vence?: FaixaDeVencimento; pessoa?: { id: string; name: string } } = {},
): string {
  const desatualizados = recorte === 'desatualizados';
  return `/properties${query({
    aba: RECORTES_DE_FASE.includes(recorte) ? ABA_NA_URL.development : null,
    recorte,
    vence: desatualizados ? opcoes.vence : null,
    desde: recorte === 'novos' ? diaValido(opcoes.desde) : null,
    ate: recorte === 'novos' ? diaValido(opcoes.ate) : null,
    meus: opcoes.meus ? '1' : null,
    pessoa: desatualizados && !opcoes.meus ? opcoes.pessoa?.id : null,
    pessoa_nome: desatualizados && !opcoes.meus ? opcoes.pessoa?.name : null,
  })}`;
}

export function lerRecorteImoveis(sp: URLSearchParams): FiltroImoveis | null {
  const recorte = sp.get('recorte');
  if (!recorte || !(recorte in RECORTES_IMOVEIS)) return null;
  const base = RECORTES_IMOVEIS[recorte as RecorteImoveis];
  const params = { ...base.params };
  const desde = diaValido(sp.get('desde'));
  if (recorte === 'novos' && desde) params.created_since = desde;
  // Sem o fim, um "Novos" do mês passado listaria até hoje e o número não bateria.
  const ate = diaValido(sp.get('ate'));
  if (recorte === 'novos' && ate) params.created_until = ate;
  const meus = sp.get('meus') === '1';
  if (meus) params.mine = '1';
  let rotulo = base.rotulo;
  const vence = sp.get('vence');
  if (recorte === 'desatualizados' && ehFaixa(vence)) {
    // A faixa já diz quais imóveis; "amanhã" ainda não venceu, então sem stale.
    delete params.stale;
    params.vence = vence;
    rotulo = `${rotulo} · ${FAIXAS[vence]}`;
  }
  const pessoa = sp.get('pessoa');
  if (recorte === 'desatualizados' && pessoa && !meus) {
    params.of_user = pessoa;
    rotulo = `${rotulo} · ${sp.get('pessoa_nome') || 'uma pessoa'}`;
  }
  return { rotulo: meus ? `${rotulo} (seus)` : rotulo, params };
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
  } else if (situacao === 'realizadas') {
    // A mesma regra do número "Visitas realizadas": marcada Realizada, pelo dia da visita.
    params.status = 'completed';
    partes.push('Realizadas');
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
