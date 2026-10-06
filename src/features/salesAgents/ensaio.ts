import type {
  RehearsalOutcome, RehearsalState, RehearsalTurn, TestMediaItem,
} from '@/services/salesAgents/salesAgentsService';
import { segundos } from '@/lib/formato';

/** O que aparece no chat do Testar, na ordem. */
export type ItemDaConversa =
  | { tipo: 'lead'; texto: string }
  | { tipo: 'ia'; texto: string; pausa: number; audio?: boolean }
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
  o.warnings.forEach((w) => linhas.push(w.reason === 'no_number'
    ? `${w.text}. O teste respondeu mesmo assim.`
    : `No atendimento real: ${w.text}. O teste respondeu mesmo assim.`));
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
      e.messages.forEach((m) => itens.push({ tipo: 'ia', texto: m.content, pausa: 0 }));
      if (e.blank) itens.push({ tipo: 'sistema', texto: 'A IA devolveu resposta vazia.' });
    });
    if (turn.idle) itens.push({ tipo: 'sistema', texto: `⏩ ${horaDoEnsaio(turn.at)} · ${turn.idle}` });
    (turn.notes ?? []).forEach((n) => itens.push({ tipo: 'sistema', texto: n.text }));
    return itens;
  }
  if (turn.kind === 'error') return [{ tipo: 'sistema', texto: `Deu erro: ${turn.outcome?.error ?? 'sem detalhe'}` }];
  if (turn.kind === 'silent' && turn.outcome?.skipped) {
    return [{ tipo: 'sistema', texto: `Ela ficaria calada: ${turn.outcome.skipped.text}` }];
  }
  if (turn.reaction) itens.push({ tipo: 'sistema', texto: `Curtiria a mensagem do lead com ${turn.reaction}` });
  if (turn.note) itens.push({ tipo: 'sistema', texto: `Sugestão pro corretor (não vai pro lead): ${turn.note}` });
  turn.messages.forEach((m) => itens.push({ tipo: 'ia', texto: m.content, pausa: m.pause_ms, ...(m.audio ? { audio: true } : {}) }));
  turn.media.forEach((item) => itens.push({ tipo: 'midia', item, propertyCode }));
  return itens;
}

/** Conversa real carregada: o histórico vira bolhas, e uma linha separa o real do teste. */
export function itensDoEstado(state: RehearsalState): ItemDaConversa[] {
  const itens: ItemDaConversa[] = state.messages.map((m) => (
    m.role === 'user' ? { tipo: 'lead' as const, texto: m.content } : { tipo: 'ia' as const, texto: m.content, pausa: 0 }
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
