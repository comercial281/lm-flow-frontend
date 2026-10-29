// O grupo de WhatsApp de um cliente, no painel raiz.
//
// O servidor reconhece o grupo de uma imobiliária de DUAS formas, nesta ordem:
//
//   1. o cadastro do cliente — dois JIDs gravados na ficha dele
//      (`whatsapp_reminder_group_jid`, o grupo do cliente; `whatsapp_logs_group_jid`,
//      o grupo de logs internos da Leal Mídia). É exato e vence tudo.
//   2. o NOME do grupo no número operacional — "APTO PREMIUM x Leal Mídia" é
//      reconhecido como grupo da APTO PREMIUM sem cadastro nenhum. É assim que
//      quase todo cliente funciona hoje.
//
// Até 2026-09-22 o cadastro só existia no assistente de criação do cliente: a
// ficha de um cliente que já existe não tinha campo nenhum para trocar o grupo —
// o painel apenas REENVIAVA o valor gravado em cada PATCH parcial, para não
// apagá-lo. Este módulo é a regra por trás do bloco *Grupos WhatsApp* da janela
// *Funções*, que passou a permitir definir e trocar.
//
// Mora fora do JSX porque o arquivo do painel tem ~1.300 linhas e nada ali é
// testável — a mesma decisão das outras traduções deste repositório.

export interface WaGroup { jid: string; name: string }

export interface ClientGroupJids {
  /** Grupo do cliente: lembretes, avisos, relatório da semana. */
  reminder: string;
  /** Grupo de logs internos (só a Leal Mídia). */
  logs: string;
}

export type ClientGroupKind = keyof ClientGroupJids;

export const GROUP_KIND_LABEL: Record<ClientGroupKind, { label: string; hint: string }> = {
  reminder: {
    label: 'Grupo do cliente',
    hint: 'O grupo "Imobiliária x Leal Mídia": recebe lembretes, avisos e o relatório da semana.',
  },
  logs: {
    label: 'Grupo de logs internos',
    hint: 'Grupo da Leal Mídia sobre este cliente. Não entra em aviso nenhum para a imobiliária.',
  },
};

/** Só JID de GRUPO vale como destino — o servidor recusa número de pessoa. */
export function isGroupJid(value: unknown): value is string {
  return typeof value === 'string' && value.trim().endsWith('@g.us');
}

/**
 * Lê os dois JIDs da ficha do cliente. O que não for JID de grupo vira vazio:
 * vazio aqui significa "sem cadastro, reconhecer pelo nome", e é o que a tela
 * mostra como tal.
 */
export function groupJidsFrom(settings: Record<string, unknown> | undefined | null): ClientGroupJids {
  const s = settings || {};
  const pick = (k: string) => {
    const v = s[k];
    return isGroupJid(v) ? v.trim() : '';
  };
  return {
    reminder: pick('whatsapp_reminder_group_jid'),
    logs: pick('whatsapp_logs_group_jid'),
  };
}

/**
 * O corpo do PATCH que grava os dois grupos.
 *
 * ⚠️ Os DOIS viajam sempre, mesmo quando só um mudou. O servidor faz `compact!`
 * nas chaves que chegam: mandar só o grupo que mudou é seguro, mas mandar um
 * deles VAZIO e omitir o outro já apagou grupo de cliente antes — por isso todo
 * PATCH parcial deste painel reenvia os dois. Este módulo é a única fonte disso.
 */
export function groupsPatch(current: ClientGroupJids, patch: Partial<ClientGroupJids> = {}) {
  const next = { ...current, ...patch };
  return {
    whatsapp_reminder_group_jid: isGroupJid(next.reminder) ? next.reminder.trim() : '',
    whatsapp_logs_group_jid: isGroupJid(next.logs) ? next.logs.trim() : '',
  };
}

export interface GroupLabel {
  /** O que a linha mostra. */
  text: string;
  /** `cadastro` = JID gravado e encontrado; `fora` = gravado mas não está na lista; `nome` = sem cadastro. */
  source: 'cadastro' | 'fora' | 'nome';
  /** Aviso em âmbar quando o grupo gravado não aparece entre os grupos do número operacional. */
  warning?: string;
}

/**
 * Como a linha descreve o grupo gravado.
 *
 * Grupo gravado que NÃO está na lista do número operacional não some da tela:
 * é justamente o caso que a pessoa precisa ver (grupo apagado, número saiu
 * dele, ou lista ainda não carregada). Sumir com ele faria o próximo *Salvar*
 * de qualquer outro bloco reenviar um valor que ninguém vê.
 */
export function groupLabel(jid: string, groups: WaGroup[] | null, kind: ClientGroupKind): GroupLabel {
  if (!jid) {
    return kind === 'reminder'
      ? { text: 'Sem cadastro — reconhecido pelo nome do grupo', source: 'nome' }
      : { text: 'Sem cadastro', source: 'nome' };
  }
  const found = groups?.find(g => g.jid === jid);
  if (found) return { text: found.name, source: 'cadastro' };
  if (groups === null) return { text: jid, source: 'cadastro' };
  return {
    text: jid,
    source: 'fora',
    warning: 'Este grupo está gravado, mas não aparece entre os grupos do número operacional (foi apagado, ou o número saiu dele). Troque ou limpe.',
  };
}

/**
 * Como o servidor reconhece o grupo deste cliente PELO NOME, para a tela dizer
 * em vez de deixar a pessoa adivinhar: termina em "Leal Mídia" e começa com o
 * nome do cliente. É a mesma regra do `Evolution::ClientGroups` do servidor,
 * escrita aqui só como TEXTO — quem decide continua sendo ele.
 */
export function nameRuleHint(clientName: string): string {
  const nome = clientName.trim() || 'Nome do cliente';
  return `Sem cadastro, vale o grupo do número operacional cujo nome é "${nome} x Leal Mídia" (o nome precisa bater com o cadastro do cliente, e não pode existir outro cliente com o mesmo nome).`;
}

/** Texto sem acento, minúsculo, espaço único e sem sobra no fim: base de toda comparação de nome de grupo. */
export function normalizeGroupName(t: string): string {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9]+$/, '').trim();
}

// O número do cliente na Leal ("[#185]"). Vinha na frente do nome ("[#154] DAIANE
// ROSA - LEAL MÍDIA") e desde out/2026 os grupos são renomeados com ele no fim
// ("PANDORA | LEAL MÍDIA [#185]"): a regra aceita os dois.
const NUMERO_DO_CLIENTE = /\[#\s*(\d+)\s*\]/;

/** O número do cliente no nome do grupo, na frente ou no fim; null quando não tem. */
export function groupClientNumber(name: string): number | null {
  const m = NUMERO_DO_CLIENTE.exec(name);
  return m ? Number(m[1]) : null;
}

/** O nome sem o "[#NNN]" e sem emoji ou sinal na frente: "🟦 [#102] CRISTIAN - LEAL MÍDIA" vira "cristian - leal midia". */
function baseGroupName(name: string): string {
  return normalizeGroupName(name.replace(new RegExp(NUMERO_DO_CLIENTE.source, 'g'), ' ')).replace(/^[^a-z0-9]+/, '');
}

/**
 * Ordem da lista de escolha: o grupo com o nome do cliente; os grupos de cliente
 * (com número), do mais novo pro mais velho; os de logs; os "... Leal Mídia" sem
 * número (reuniões de prospecção); o resto. São ~90 grupos no número operacional.
 */
export function sortGroupsForPicker(groups: WaGroup[], clientName: string): WaGroup[] {
  const alvo = normalizeGroupName(clientName);
  const faixa = (g: WaGroup) => {
    const n = normalizeGroupName(g.name);
    if (alvo && n.includes(alvo)) return 0;
    if (groupClientNumber(g.name) !== null) return 1;
    if (/\blogs\b/.test(n)) return 2;
    if (baseGroupName(g.name).endsWith('leal midia')) return 3;
    return 4;
  };
  return groups
    .map(g => ({ g, faixa: faixa(g), numero: groupClientNumber(g.name) ?? -1 }))
    .sort((a, b) => a.faixa - b.faixa || b.numero - a.numero || a.g.name.localeCompare(b.g.name, 'pt-BR'))
    .map(x => x.g);
}

/** A busca da lista de escolha: pedaço do nome ou do número, sem acento nem caixa. */
export function searchGroups(groups: WaGroup[], busca: string): WaGroup[] {
  const termo = normalizeGroupName(busca);
  if (!termo) return groups;
  return groups.filter(g => normalizeGroupName(g.name).includes(termo));
}

// ── Lista de grupos liberados (desde 2026-10-15) ─────────────────────────────
// A Leal monta, por cliente, os grupos da central que ele pode ver e usar.
// Chave AUSENTE = cliente ainda não mapeado (vale a regra do nome); chave com
// lista, mesmo vazia, = só a lista vale. O tipo vem gravado, nunca do nome.
export type AllowedKind = 'cliente' | 'logs';
export interface AllowedGroup { jid: string; name: string; kind: AllowedKind }
export const ALLOWED_KEY = 'allowed_whatsapp_groups';
export const ALLOWED_KIND_LABEL: Record<AllowedKind, string> = { cliente: 'Com o cliente', logs: 'Interno da Leal' };

function sanitizeAllowed(list: unknown): AllowedGroup[] {
  if (!Array.isArray(list)) return [];
  const vistos = new Set<string>();
  const out: AllowedGroup[] = [];
  for (const raw of list) {
    const g = (raw ?? {}) as Record<string, unknown>;
    const jid = typeof g.jid === 'string' ? g.jid.trim() : '';
    const kind = g.kind === 'cliente' || g.kind === 'logs' ? g.kind : null;
    if (!isGroupJid(jid) || !kind || vistos.has(jid)) continue;
    vistos.add(jid);
    out.push({ jid, name: typeof g.name === 'string' ? g.name.trim() : '', kind });
  }
  return out;
}

export function allowedGroupsFrom(settings: Record<string, unknown> | undefined | null): AllowedGroup[] | null {
  const s = settings || {};
  if (!Object.prototype.hasOwnProperty.call(s, ALLOWED_KEY)) return null;
  return sanitizeAllowed(s[ALLOWED_KEY]);
}

export function allowedGroupsPatch(list: AllowedGroup[]) {
  return { [ALLOWED_KEY]: sanitizeAllowed(list) } as { allowed_whatsapp_groups: AllowedGroup[] };
}

export function addAllowedGroup(list: AllowedGroup[], group: WaGroup, kind: AllowedKind): AllowedGroup[] {
  if (list.some(g => g.jid === group.jid)) return list;
  return [...list, { jid: group.jid, name: group.name, kind }];
}

export function removeAllowedGroup(list: AllowedGroup[], jid: string): AllowedGroup[] {
  return list.filter(g => g.jid !== jid);
}

/** Pré-preenchimento de quem ainda não foi mapeado: o grupo "Cliente x Leal Mídia" (com ou sem "[#NNN]") + os dois cadastros antigos. */
export function suggestAllowedGroups(central: WaGroup[], clientName: string, legacy: ClientGroupJids): AllowedGroup[] {
  const alvo = normalizeGroupName(clientName);
  let lista: AllowedGroup[] = [];
  for (const g of central) {
    const n = baseGroupName(g.name);
    if (alvo && n.startsWith(alvo) && n.endsWith('leal midia')) lista = addAllowedGroup(lista, g, 'cliente');
  }
  const nomeDe = (jid: string) => central.find(g => g.jid === jid)?.name ?? jid;
  if (legacy.reminder) lista = addAllowedGroup(lista, { jid: legacy.reminder, name: nomeDe(legacy.reminder) }, 'cliente');
  if (legacy.logs) lista = addAllowedGroup(lista, { jid: legacy.logs, name: nomeDe(legacy.logs) }, 'logs');
  return lista;
}

export function allowedRow(g: AllowedGroup, central: WaGroup[] | null): { text: string; warning?: string } {
  if (central === null) return { text: g.name || g.jid };
  const vivo = central.find(c => c.jid === g.jid);
  if (vivo) return { text: vivo.name };
  return {
    text: g.name || g.jid,
    warning: 'Este grupo está na lista, mas não aparece entre os grupos do número operacional (foi apagado, ou o número saiu dele). Remova ou troque.',
  };
}
