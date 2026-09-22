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

/** Os grupos que já têm cara de grupo de cliente vão primeiro na lista, ordenados; o resto depois. */
export function sortGroupsForPicker(groups: WaGroup[], clientName: string): WaGroup[] {
  const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9]+$/, '').trim();
  const alvo = norm(clientName);
  const score = (g: WaGroup) => {
    const n = norm(g.name);
    if (alvo && n.startsWith(alvo)) return 0;
    if (n.endsWith('leal midia')) return 1;
    return 2;
  };
  return [...groups].sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name, 'pt-BR'));
}
