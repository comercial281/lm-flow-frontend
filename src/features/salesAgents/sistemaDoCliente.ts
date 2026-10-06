import type { WebhookDelivery } from '@/services/salesAgents/salesAgentsService';
import { diaMesNoFuso, horaNoFuso, segundos as segundosDaCasa } from '@/lib/formato';

// Sistema do cliente (05/10/2026): o 4º destino do lead em "Pra onde vai o lead".
// A IA passa o lead e ele vai, assinado, pro sistema que a imobiliária já usa.
// Aqui ficam as regras PURAS da tela. Quem manda é o servidor: ele recusa endereço
// interno na gravação e confere de novo, com DNS, em cada envio.

const FUSO = 'America/Sao_Paulo';
export const ENDERECO_MAX = 500;

const INTERNO = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.internal$/i,
  /\.local$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
];

export type Tom = 'ok' | 'alerta' | 'erro';

export function problemaNoEndereco(bruto: string): string | null {
  const url = bruto.trim();
  if (!url) return 'Preencha o endereço do sistema do cliente.';
  if (url.length > ENDERECO_MAX) return 'Endereço longo demais (máximo 500 caracteres).';
  if (!/^https:\/\//i.test(url)) return 'O endereço precisa começar com https://';
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return 'Este endereço não é válido.';
  }
  if (!host) return 'Este endereço não é válido.';
  if (INTERNO.some((re) => re.test(host))) return 'Endereço de rede interna não é aceito.';
  return null;
}

/** Na persona corretor o lead vai sempre pro dono do número (decisão do Tony, 04/10). */
export function webhookDisponivel(persona: 'broker' | 'owner' | 'assistant'): boolean {
  return persona !== 'broker';
}

export function hora(iso: string | null | undefined): string {
  if (!iso) return '';
  return horaNoFuso(iso, FUSO);
}

export function dataHora(iso: string | null | undefined): string {
  if (!iso) return '';
  return `${diaMesNoFuso(iso, FUSO)} ${hora(iso)}`;
}

export function segundos(ms: number): string {
  return segundosDaCasa(ms);
}

/** O que o código da resposta significa, em português, pro gestor repassar a quem cuida do sistema. */
export function fraseDaResposta(code: number | null): string {
  if (code === null) return 'não respondeu';
  if (code >= 200 && code < 300) return `recebeu (código ${code})`;
  if (code >= 300 && code < 400) return `mandou pra outro endereço (código ${code}): cadastre o endereço final`;
  if (code === 401 || code === 403) return `recusou (código ${code}): confira se a chave secreta cadastrada lá é a atual`;
  if (code === 404) return `não achou o endereço (código ${code})`;
  if (code === 429) return `pediu pra esperar (código ${code})`;
  if (code >= 500) return `deu erro do lado dele (código ${code})`;
  return `recusou (código ${code})`;
}

export function situacaoDoEnvio(d: WebhookDelivery): { tom: Tom; texto: string } {
  if (d.status === 'delivered') {
    return { tom: 'ok', texto: d.attempts > 1 ? `Entregue na ${d.attempts}ª tentativa` : 'Entregue' };
  }
  if (d.status === 'failed') {
    return { tom: 'erro', texto: `Não entregue (${d.attempts} ${d.attempts === 1 ? 'tentativa' : 'tentativas'})` };
  }
  if (d.next_attempt_at && d.attempts > 0) {
    return { tom: 'alerta', texto: `Tentando de novo às ${hora(d.next_attempt_at)} (${d.attempts} de ${d.max_attempts})` };
  }
  return { tom: 'alerta', texto: 'Enviando…' };
}

/**
 * A linha do painel do lead, lida do espelho que o servidor grava na conversa
 * (`additional_attributes.sales_agent_handoff_webhook`).
 */
export function linhaNoPainelDoLead(attrs: Record<string, unknown>): { tom: Tom; texto: string } | null {
  const info = attrs.sales_agent_handoff_webhook;
  if (!info || typeof info !== 'object') return null;
  const { status, at, error, system, owner } = info as { status?: string; at?: string; error?: string; system?: string; owner?: string };
  // CVCRM (06/10/2026): o servidor grava `system: 'cvcrm'` e, entregue, pra quem foi.
  if (system === 'cvcrm') {
    if (status === 'pending') return { tom: 'alerta', texto: 'Enviando ao CVCRM…' };
    if (status === 'delivered') {
      return { tom: 'ok', texto: `Entregue no CVCRM às ${hora(at)}${owner ? ` para ${owner}` : ', na distribuição do CVCRM'}.` };
    }
    if (status === 'failed') {
      // As frases do CVCRM terminam em ponto: sem ele aqui, sairia "token.. A gestão".
      const motivo = (error ?? '').trim().replace(/\.+$/, '');
      return { tom: 'erro', texto: `O envio ao CVCRM falhou${motivo ? `: ${motivo}` : ''}. A gestão foi avisada; o lead não foi pra roleta.` };
    }
    return null;
  }
  if (status === 'pending') return { tom: 'alerta', texto: 'Enviando ao sistema do cliente…' };
  if (status === 'delivered') return { tom: 'ok', texto: `Enviado ao sistema do cliente às ${hora(at)}.` };
  if (status === 'failed') {
    return {
      tom: 'erro',
      texto: `O envio ao sistema do cliente falhou${error ? `: ${error}` : ''}. A gestão foi avisada; o lead não foi pra roleta.`,
    };
  }
  return null;
}
