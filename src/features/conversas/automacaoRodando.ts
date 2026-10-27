import { dataCurta, hora, toDate } from '@/lib/formato';
import type { RunningFlow } from '@/services/flowAutomations/flowAutomationInstancesService';

/**
 * As linhas da faixa "tem mensagem automática programada pra este lead",
 * acima do campo de mensagem (03/10/2026). Fluxo do construtor e follow-up
 * aparecem juntos: pra quem atende é a mesma coisa.
 */
export interface LinhaAutomatica {
  key: string;
  /**
   * Como a linha se apresenta. O fluxo de follow-up (sprint 3) é `followup`; o
   * funil de conversa disparado no campo de mensagem (sprint 4) é `funil`.
   */
  tipo: 'fluxo' | 'followup' | 'funil';
  /** Id da instância do fluxo (automação, follow-up ou funil): é por ele que o Parar age. */
  id: string;
  texto: string;
  podeParar: boolean;
}

/** "14:32" hoje; "04/10 às 9:00" em outro dia. */
export function quando(valor: unknown, agora: Date = new Date()): string {
  const d = toDate(valor);
  if (!d) return '';
  const mesmoDia =
    d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth() && d.getDate() === agora.getDate();
  return mesmoDia ? hora(d) : `${dataCurta(d)} às ${hora(d)}`;
}

/** "sai às 14:32" hoje; "sai em 04/10 às 9:00" em outro dia (a vez do número no gotejamento). */
export function saiAs(valor: unknown, agora: Date = new Date()): string {
  const texto = quando(valor, agora);
  return texto.includes('às') ? `sai em ${texto}` : `sai às ${texto}`;
}

export function linhaDoFluxo(fluxo: RunningFlow, agora: Date = new Date()): LinhaAutomatica {
  // Sprint 3: o fluxo da aba Follow-up aparece como "Follow-up "X"".
  // Sprint 4: o funil de conversa aparece como "Funil "X"".
  const followup = fluxo.kind === 'followup';
  const funil = fluxo.kind === 'conversation';
  const rotulo = followup ? 'Follow-up' : funil ? 'Funil' : 'Fluxo';
  // Nome já mascarado pelo servidor ("Follow-up de Ana"): vale como veio, sem aspas nem outro rótulo.
  const nome = fluxo.flow_name
    ? (fluxo.flow_masked ? fluxo.flow_name : `${rotulo} "${fluxo.flow_name}"`)
    : rotulo;
  let fase = 'em andamento';
  if (fluxo.phase === 'waiting_reply') {
    fase = fluxo.until ? `aguardando resposta até ${quando(fluxo.until, agora)}` : 'aguardando resposta, sem limite';
  } else if (fluxo.phase === 'waiting') {
    fase = fluxo.until ? `esperando até ${quando(fluxo.until, agora)}` : 'esperando';
  } else if (fluxo.phase === 'paused') {
    fase = fluxo.paused_reason ? `pausado: ${fluxo.paused_reason}` : 'pausado';
  } else if (fluxo.phase === 'queued') {
    fase = fluxo.until ? `na fila, ${saiAs(fluxo.until, agora)}` : 'na fila';
  }
  return {
    key: `fluxo-${fluxo.id}`,
    tipo: followup ? 'followup' : funil ? 'funil' : 'fluxo',
    id: fluxo.id,
    texto: `${nome} · ${fase}`,
    podeParar: fluxo.active,
  };
}

export function linhasAutomaticas(fluxos: RunningFlow[], agora: Date = new Date()): LinhaAutomatica[] {
  return fluxos.filter(f => f.active).map(f => linhaDoFluxo(f, agora));
}

/** Identifica o conjunto de automações rodando: "Enviar e manter" vale até ele mudar. */
export function assinaturaDasLinhas(linhas: LinhaAutomatica[]): string {
  return linhas.map(l => l.key).sort().join('|');
}

/** O botão principal da pergunta na hora de enviar. */
export function rotuloDeParar(linhas: LinhaAutomatica[]): string {
  const tipos = new Set(linhas.map(l => l.tipo));
  if (tipos.size > 1 || linhas.length > 1) return 'Enviar e tirar das automações';
  if (tipos.has('funil')) return 'Enviar e parar o funil';
  return tipos.has('followup') ? 'Enviar e parar o follow-up' : 'Enviar e tirar do fluxo';
}
