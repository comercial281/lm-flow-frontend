import type { Portal, PortalAdType } from '@/services/portals/portalsService';
import { tempoDesde } from '@/lib/formato';

// ── SITUAÇÃO DO PORTAL (redesenho de Portais, 12/10/2026) ───────────────────
//
// Uma situação só por portal, no selo da casa (verde funcionando, laranja
// atenção, vermelho erro, cinza desligado). Antes a lista juntava "Formato
// validado", "Não conectado — clique…", o relógio e "ATIVO/AGUARDANDO/INATIVO",
// e AGUARDANDO valia pra quem nunca foi lido E pra quem parou de ler.
//
// "Recebendo" é o `active` do servidor (leu nas últimas 48 h): a regra mora lá.
// Daqui só sai a separação que o servidor não dá: conectado sem leitura nenhuma
// (esperando) × conectado com leitura antiga (parou).

export type ChaveDaSituacao = 'nao_conectado' | 'esperando' | 'recebendo' | 'parou';

export interface Situacao {
  chave: ChaveDaSituacao;
  rotulo: string;
  /** O `status` do `BaseStatusBadge`. */
  selo: 'inactive' | 'warning' | 'success' | 'error';
  /** A frase de apoio ("Leu o feed há 2 h"); vazia quando não há o que dizer. */
  detalhe: string;
}

export function situacaoDoPortal(
  portal: Pick<Portal, 'connected' | 'active' | 'last_accessed_at'>,
  agora: Date = new Date(),
): Situacao {
  if (!portal.connected) {
    return { chave: 'nao_conectado', rotulo: 'Não conectado', selo: 'inactive', detalhe: '' };
  }
  if (portal.active && portal.last_accessed_at) {
    return { chave: 'recebendo', rotulo: 'Recebendo', selo: 'success', detalhe: `Leu o feed ${tempoDesde(portal.last_accessed_at, agora)}` };
  }
  if (portal.last_accessed_at) {
    return { chave: 'parou', rotulo: 'Parou de ler', selo: 'error', detalhe: `Última leitura ${tempoDesde(portal.last_accessed_at, agora)}` };
  }
  return { chave: 'esperando', rotulo: 'Esperando 1ª leitura', selo: 'warning', detalhe: 'O portal ainda não leu o feed' };
}

const temCota = (t: PortalAdType) => t.limit !== null && t.limit !== undefined && t.limit > 0;

/**
 * Os tipos de anúncio que valem mostrar: com cota no plano ou com imóvel. O
 * ZAP tem seis tipos e quase ninguém usa todos — seis "0" na linha era poluição.
 */
export function tiposEmUso(adTypes: PortalAdType[]): PortalAdType[] {
  return adTypes.filter(t => t.count > 0 || temCota(t));
}

/** "A" · "A e B" · "A, B e C". */
function juntarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes.join('');
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

export interface ResumoDaCota {
  texto: string;
  tom: 'neutro' | 'atencao' | 'erro';
}

/**
 * Uma frase sobre a cota pra linha da lista. Acima da cota manda (o portal
 * rebaixa os que sobram); depois, os tipos cheios; com um tipo só, "N de M".
 * Sem cota nenhuma gravada, nada a dizer.
 */
export function resumoDaCota(adTypes: PortalAdType[]): ResumoDaCota | null {
  const comCota = adTypes.filter(temCota);
  if (comCota.length === 0) return null;
  const acima = comCota.filter(t => t.count > (t.limit as number));
  if (acima.length > 0) return { texto: `${juntarNomes(acima.map(t => t.label))} acima da cota`, tom: 'erro' };
  const cheios = comCota.filter(t => t.count === t.limit);
  if (cheios.length > 0) return { texto: `${juntarNomes(cheios.map(t => t.label))} no limite`, tom: 'atencao' };
  if (comCota.length === 1) return { texto: `${comCota[0].count} de ${comCota[0].limit}`, tom: 'neutro' };
  return { texto: 'Dentro da cota', tom: 'neutro' };
}
