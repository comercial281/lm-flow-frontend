import type {
  RehearsalOutcome, RehearsalState, RehearsalTurn, TestMediaItem,
} from '@/services/salesAgents/salesAgentsService';
import { segundos } from '@/lib/formato';
import { MOMENTOS_DO_FUNIL } from '@/pages/Customer/Automations/SalesAgents/configurar/opcoes';

/**
 * O que aparece no chat do Testar, na ordem. `hora` = "14:02" do relógio do
 * teste; `lida` = os dois tiques azuis (ela respondeu).
 */
export type ItemDaConversa =
  | { tipo: 'lead'; texto: string; hora?: string; lida?: boolean }
  | { tipo: 'ia'; texto: string; pausa: number; audio?: boolean; hora?: string }
  | { tipo: 'midia'; item: TestMediaItem; propertyCode: string }
  | { tipo: 'sistema'; texto: string };

export const OPCOES_DE_AVANCO: ReadonlyArray<{ rotulo: string; horas: number | null }> = [
  { rotulo: 'Até a IA agir sozinha', horas: null },
  { rotulo: '1 hora', horas: 1 },
  { rotulo: '2 horas', horas: 2 },
  { rotulo: '8 horas', horas: 8 },
  { rotulo: '1 dia', horas: 24 },
  { rotulo: '3 dias', horas: 72 },
];

const TEMPERATURA: Record<string, string> = { hot: 'Quente', warm: 'Morna', cold: 'Fria', unknown: 'Ainda não dá pra saber' };
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/**
 * "seg, 05/10 14:02". Lida do PRÓPRIO texto: o servidor manda no fuso da
 * imobiliária, e converter pelo fuso do navegador mostraria outra hora.
 */
export function horaDoEnsaio(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return '';
  const [, ano, mes, dia, h, min] = m;
  const semana = DIAS[new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia))).getUTCDay()];
  return `${semana}, ${dia}/${mes} ${h}:${min}`;
}

/** "14:02", lido do próprio texto (mesmo motivo do horaDoEnsaio). */
export function horaCurta(iso: string | null | undefined): string | undefined {
  const m = /T(\d{2}):(\d{2})/.exec(iso ?? '');
  return m ? `${m[1]}:${m[2]}` : undefined;
}

/**
 * Quanto tempo os três pontinhos ficam antes de cada bolha dela. A pausa de
 * verdade (a rajada espera uns segundos entre uma mensagem e outra) fica bem mais
 * curta no teste, senão ele arrasta; texto maior demora um pouco mais.
 */
export function tempoDeDigitacao(texto: string, pausaMs: number): number {
  const pelaPausa = pausaMs * 0.25;
  const peloTexto = 400 + texto.length * 12;
  return Math.round(Math.min(1800, Math.max(700, pelaPausa, peloTexto)));
}

/** "faixa_de_investimento" → "Faixa de investimento" (a chave do Meta vem assim). */
export function rotuloDaPergunta(chave: string): string {
  const t = chave.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : chave;
}

/** "Haiku", "Sonnet"… a partir do id do modelo; id desconhecido sai como veio. */
export function nomeDoModelo(id: string | null | undefined): string | null {
  if (!id) return null;
  const familia = ['Haiku', 'Sonnet', 'Opus', 'Fable'].find((f) => id.toLowerCase().includes(f.toLowerCase()));
  return familia ?? id;
}

/**
 * O Testar roda no modelo de teste (Haiku), não necessariamente no da IA —
 * decisão do dono do produto (05/10): a meta é toda IA no Haiku. A tela diz isso
 * sempre, e avisa quando a IA atende o lead em outro modelo.
 */
export function avisoDoModelo(
  modeloDoTeste: string | null | undefined, modeloDaIa: string | null | undefined,
): { selo: string | null; nota: string | null } {
  const teste = nomeDoModelo(modeloDoTeste);
  const ia = nomeDoModelo(modeloDaIa);
  return {
    selo: teste ? `Teste no ${teste}` : null,
    nota: teste && ia && ia !== teste ? `Esta IA atende no ${ia}; o teste usa o ${teste}` : null,
  };
}

export function pausa(ms: number): string {
  if (!ms) return '';
  return `digitando ${segundos(ms)}`;
}

const ROTULOS_DA_FICHA: Array<[string, string]> = [
  ['motivo', 'Por que está procurando'], ['tipo_imovel', 'Tipo de imóvel'], ['regiao', 'Região'],
  ['orcamento', 'Orçamento'], ['prazo', 'Prazo'], ['financiamento', 'Financiamento'], ['fgts', 'FGTS'],
];

export function linhasDoQueAconteceria(o: RehearsalOutcome | null | undefined): string[] {
  if (!o) return [];
  const linhas: string[] = [];
  if (o.error) linhas.push(`Deu erro neste turno: ${o.error}`);
  if (o.delay_s && !o.skipped) linhas.push(`Responderia uns ${o.delay_s} s depois da mensagem do lead`);
  if (o.skipped) linhas.push(`Ela ficaria calada: ${o.skipped.text}`);
  // ⚠️ O texto de "sem número" do servidor já diz "no atendimento real": não prefixar de novo.
  o.warnings.forEach((w) => linhas.push(
    w.reason === 'no_number' ? `${w.text}. O teste respondeu mesmo assim.`
      : w.reason === GATILHO ? AVISO_DO_GATILHO
        : `No atendimento real: ${w.text}. O teste respondeu mesmo assim.`,
  ));
  if (o.handoff) {
    if (o.handoff.kind === 'none') {
      linhas.push(`Tentaria passar o lead, mas não tem pra quem: ${o.handoff.problem ?? 'destino não configurado'}`);
    } else if (o.handoff.kind === 'webhook') {
      linhas.push('Mandaria o lead pro sistema do cliente agora');
    } else if (o.handoff.kind === 'owner') {
      linhas.push(`Devolveria o lead pro dono dele: ${o.handoff.destination}`);
    } else {
      linhas.push(`Passaria pra ${o.handoff.destination} agora`);
    }
    if (o.handoff.reason) linhas.push(`Motivo pro corretor: ${o.handoff.reason}`);
  }
  if (o.handoff_blocked) linhas.push(`Quis passar, mas a regra segurou: ${o.handoff_blocked}`);
  if (o.visit) linhas.push(`Marcaria visita ${o.visit.label}${o.visit.realtor ? ` com ${o.visit.realtor}` : ''}`);
  if (o.out_of_hours_notice) linhas.push('Mandaria o aviso de fora do horário');
  if (o.opening) linhas.push(`Abertura usada: ${o.opening}`);
  if (o.lead_owner) linhas.push(`Este lead já tem dono: ${o.lead_owner}`);
  const faltam = o.checklist.filter((c) => c.obrigatoria && !String(c.resposta ?? '').trim()).length;
  if (faltam > 0) {
    linhas.push(`${faltam === 1 ? 'Falta 1 pergunta obrigatória' : `Faltam ${faltam} perguntas obrigatórias`} antes de passar`);
  }
  // Mesmos rótulos do painel do lead; chave sem rótulo ou valor que não é texto fica de fora.
  const ficha = ROTULOS_DA_FICHA
    .map(([k, rotulo]) => [rotulo, o.collected[k]] as const)
    .filter(([, v]) => (typeof v === 'string' || typeof v === 'number') && String(v).trim() !== '')
    .map(([rotulo, v]) => `${rotulo}: ${String(v)}`);
  if (ficha.length) linhas.push(`Ficha: ${ficha.join(' · ')}`);
  if (o.temperature) linhas.push(`Temperatura: ${TEMPERATURA[o.temperature] ?? o.temperature}`);
  o.notes.forEach((n) => linhas.push(`Ajuste: ${n.text}`));
  return linhas;
}

/** Cada trava do atendimento real em poucas palavras (a frase do servidor é a do Diagnóstico, longa). */
const TRAVA_CURTA: Record<string, string> = {
  no_number: 'Está sem número',
  agent_disabled: 'Está desligada',
  followup_only: 'Está em "só follow-up"',
  schedule_closed: 'Fora do horário de atendimento',
  daily_limit_reached: 'Limite do dia atingido',
  trigger_no_match: 'Nenhum gatilho bateu',
};

/**
 * O "O que aconteceria" do Testar (pedido do dono do produto, 08/10/2026): as
 * travas juntas num bloco só, com um "o teste respondeu mesmo assim" só, e
 * embaixo o que ela faria. Com trava, não diz em quantos segundos responderia
 * (não responderia). Temperatura e perguntas obrigatórias ficam de fora: já têm
 * seção própria no painel. A Comparação do admin segue com linhasDoQueAconteceria.
 */
export function oQueAconteceria(o: RehearsalOutcome | null | undefined): { travas: string[]; linhas: string[] } {
  if (!o) return { travas: [], linhas: [] };
  const travas = o.warnings.map((w) => TRAVA_CURTA[w.reason] ?? w.text);
  const linhas = linhasDoQueAconteceria({ ...o, warnings: [], temperature: null, checklist: [] })
    .filter((l) => !(travas.length && l.startsWith('Responderia uns ')));
  return { travas, linhas };
}

/** O motivo do gatilho que não bateu (SalesAgentRun::MOTIVOS_PT['trigger_no_match']). */
export const GATILHO = 'trigger_no_match';
export const AVISO_DO_GATILHO = 'No atendimento real ela não entraria aqui: nenhum gatilho bateu. O teste respondeu mesmo assim.';

function rotuloDoEvento(kind: string, attempt: number): string {
  if (kind === 'reengagement') return `Retomada ${attempt} de 2`;
  if (kind === 'followup') return `Follow-up ${attempt}`;
  return 'Follow-up entregue ao funil (sem mensagem da IA)';
}

/** As bolhas de UM passo do ensaio. `propertyCode` = o imóvel DESTE turno (Mandar pra mim). */
export function itensDoTurno(turn: RehearsalTurn, propertyCode: string): ItemDaConversa[] {
  const itens: ItemDaConversa[] = [];
  if (turn.kind === 'advance') {
    (turn.events ?? []).forEach((e) => {
      itens.push({ tipo: 'sistema', texto: `⏩ ${horaDoEnsaio(e.at)} · ${rotuloDoEvento(e.kind, e.attempt)}` });
      e.messages.forEach((m) => itens.push({ tipo: 'ia', texto: m.content, pausa: 0, hora: horaCurta(e.at) }));
      if (e.blank) itens.push({ tipo: 'sistema', texto: 'A IA devolveu resposta vazia.' });
    });
    if (turn.idle) itens.push({ tipo: 'sistema', texto: `⏩ ${horaDoEnsaio(turn.at)} · ${turn.idle}` });
    (turn.notes ?? []).forEach((n) => itens.push({ tipo: 'sistema', texto: n.text }));
    return itens;
  }
  if (turn.kind === 'error') return [{ tipo: 'sistema', texto: `Deu erro: ${turn.outcome?.error ?? 'sem detalhe'}` }];
  if (turn.kind === 'silent' && turn.outcome?.skipped) {
    const dica = turn.outcome.skipped.reason === GATILHO ? '. Desligue "Respeitar o gatilho" pra ver como ela responderia.' : '';
    return [{ tipo: 'sistema', texto: `Ela ficaria calada: ${turn.outcome.skipped.text}${dica}` }];
  }
  if (turn.reaction) itens.push({ tipo: 'sistema', texto: `Curtiria a mensagem do lead com ${turn.reaction}` });
  if (turn.note) itens.push({ tipo: 'sistema', texto: `Sugestão pro corretor (não vai pro lead): ${turn.note}` });
  const hora = horaCurta(turn.at);
  turn.messages.forEach((m) => itens.push({ tipo: 'ia', texto: m.content, pausa: m.pause_ms, hora, ...(m.audio ? { audio: true } : {}) }));
  turn.media.forEach((item) => itens.push({ tipo: 'midia', item, propertyCode }));
  return itens;
}

/** Conversa real carregada: o histórico vira bolhas, e uma linha separa o real do teste. */
export function itensDoEstado(state: RehearsalState): ItemDaConversa[] {
  const itens: ItemDaConversa[] = state.messages.map((m) => (
    m.role === 'user'
      ? { tipo: 'lead' as const, texto: m.content, hora: horaCurta(m.at), lida: true }
      : { tipo: 'ia' as const, texto: m.content, pausa: 0, hora: horaCurta(m.at) }
  ));
  itens.push({ tipo: 'sistema', texto: 'Até aqui é a conversa real. Daqui pra frente é teste.' });
  return itens;
}

/** "Pergunta: resposta", uma por linha. Linha sem ":" é ignorada. */
export function respostasDoFormulario(texto: string): Record<string, string> {
  const r: Record<string, string> = {};
  texto.split('\n').forEach((linha) => {
    // O PRIMEIRO dois-pontos separa: resposta tem hora e link ("14:30", "https:").
    const i = linha.indexOf(':');
    if (i <= 0) return;
    const pergunta = linha.slice(0, i).trim();
    const resposta = linha.slice(i + 1).trim();
    if (pergunta && resposta) r[pergunta] = resposta;
  });
  return r;
}

export function textoDasRespostas(r: Record<string, string>): string {
  return Object.entries(r).map(([k, v]) => `${k}: ${v}`).join('\n');
}

/** Os botões de "Avançar o tempo" da janela do Testar (spec §5 + "até ela agir"). */
export const AVANCOS_DA_JANELA: ReadonlyArray<{ rotulo: string; horas: number | null }> = [
  { rotulo: 'Até ela agir sozinha', horas: null },
  { rotulo: '1 h', horas: 1 },
  { rotulo: '+8 h', horas: 8 },
  { rotulo: '1 dia', horas: 24 },
  { rotulo: '3 dias', horas: 72 },
];

const NIVEL: Record<string, 0 | 1 | 2 | 3> = { unknown: 0, cold: 1, warm: 2, hot: 3 };

export interface PainelDoEnsaio {
  /** O caminho da intenção que ela escolheu (onda 2). */
  caminho: string | null;
  temperatura: { rotulo: string; nivel: 0 | 1 | 2 | 3 } | null;
  perguntas: { texto: string; resposta: string | null; obrigatoria: boolean }[];
}

/**
 * O painel "O que ela está fazendo" do Testar: lido do estado e do último turno com ficha.
 * ⚠️ Antes da onda 2 no ar o estado vem SEM `caminho`: sai null e a tela diz "Ainda não escolheu".
 */
export function painelDoEnsaio(state: RehearsalState | null, o: RehearsalOutcome | null | undefined): PainelDoEnsaio {
  const t = o?.temperature ?? null;
  return {
    caminho: state?.caminho ?? null,
    temperatura: t ? { rotulo: TEMPERATURA[t] ?? t, nivel: NIVEL[t] ?? 0 } : null,
    perguntas: (o?.checklist ?? []).map((c) => ({
      texto: c.pergunta,
      resposta: String(c.resposta ?? '').trim() ? c.resposta : null,
      obrigatoria: c.obrigatoria,
    })),
  };
}

/**
 * "Card: vai pra coluna de …" no O que aconteceria. O servidor manda o MOMENTO da
 * conversa (descobrindo, qualificando…) e se a IA tem "Mover o card no funil"
 * ligado; a coluna de verdade é o mapa que o gestor montou, então a tela fala do
 * momento com o nome que ele vê no Configurar.
 */
export function linhaDoCard(o: RehearsalOutcome | null | undefined): string | null {
  const stage = o?.card?.stage;
  if (!o?.card || !stage) return null;
  if (!o.card.moves) return 'Card: fica onde está (Mover o card no funil está desligado)';
  const rotulo = MOMENTOS_DO_FUNIL.find(([k]) => k === stage)?.[1] ?? stage;
  return `Card: vai pra coluna de "${rotulo}"`;
}
