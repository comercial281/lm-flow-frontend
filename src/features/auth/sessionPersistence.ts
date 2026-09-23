// Guardar a sessão no aparelho — e saber quando o aparelho NÃO deixa.
//
// Por que isto existe (22/09/2026): o login gravava a chave de acesso no
// armazenamento do navegador sem nenhuma proteção. Onde a gravação é recusada
// — navegador interno do WhatsApp, aba privada, site com dados bloqueados,
// armazenamento cheio — a exceção subia e a tela de login mostrava
// "Credenciais inválidas" para um login que o servidor tinha APROVADO. Quem
// abre o CRM pelo link do WhatsApp no celular cai exatamente nesse caso, e é a
// explicação mais provável de várias corretoras não entrarem com a senha certa.
//
// Duas regras:
// - gravar NUNCA estoura (quem chama decide o que fazer);
// - quem chama SABE se foi gravado, para poder avisar em vez de acusar a senha.

export const TOKEN_KEY = 'access_token';

export interface PersistResult {
  /** A sessão vai sobreviver a um recarregamento da página? */
  persisted: boolean;
}

function write(store: Storage | undefined, key: string, value: string): boolean {
  try {
    if (!store) return false;
    store.setItem(key, value);
    // Safari em modo restrito aceita o setItem e devolve vazio na leitura:
    // conferir é o que separa "guardou" de "fingiu que guardou".
    return store.getItem(key) === value;
  } catch {
    return false;
  }
}

function remove(store: Storage | undefined, key: string): void {
  try {
    store?.removeItem(key);
  } catch {
    // Sem armazenamento não há o que limpar.
  }
}

function read(store: Storage | undefined, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/**
 * Grava a chave de acesso. Tenta o armazenamento permanente e, se ele recusar,
 * cai no da aba — melhor uma sessão que dura até fechar a aba do que nenhuma.
 */
export function persistSessionToken(token: string): PersistResult {
  if (write(safeLocal(), TOKEN_KEY, token)) return { persisted: true };
  // A sessão da aba não sobrevive a um recarregamento em toda situação, mas
  // segura a navegação de agora — e é o que o navegador embutido costuma deixar.
  write(safeSession(), TOKEN_KEY, token);
  return { persisted: false };
}

export function clearSessionToken(): void {
  remove(safeLocal(), TOKEN_KEY);
  remove(safeSession(), TOKEN_KEY);
}

export function readSessionToken(): string | null {
  return read(safeLocal(), TOKEN_KEY) ?? read(safeSession(), TOKEN_KEY);
}

/** Aviso em português para quem entrou mas não vai continuar entrado. */
export const AVISO_SEM_ARMAZENAMENTO =
  'Você entrou, mas este navegador não está guardando sua sessão — ela some ao fechar a aba. ' +
  'Se você abriu pelo link dentro do WhatsApp, toque nos três pontinhos e escolha abrir no navegador (Safari ou Chrome).';

function safeLocal(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    // Acessar localStorage já estoura com dados de site bloqueados.
    return undefined;
  }
}

function safeSession(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}
