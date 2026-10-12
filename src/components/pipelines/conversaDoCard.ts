// Regras da lista da aba Conversa do card do lead (spec 2026-10-12-conversa-do-card-design.md).
// Puras de propósito: a aba só junta estado e rolagem em volta delas.
import type { Message } from '@/types/chat/api';

/** Página do servidor: sem cursor e com `before`, 20 (MessageFinder#limit_for_params). */
export const TAMANHO_DA_PAGINA = 20;
/** Até aqui do fim a caixa conta como "no fim": mensagem nova desce sozinha. */
export const PERTO_DO_FIM_PX = 100;
/** Abaixo disso do topo, carrega as anteriores. */
export const PERTO_DO_TOPO_PX = 80;

/** Instante da mensagem em segundos (número, texto numérico ou data ISO). Sem data válida = agora. */
export function instanteDaMensagem(m: Message): number {
  const raw = m.created_at as unknown;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    if (!Number.isNaN(n)) return n;
    const ms = Date.parse(raw);
    if (!Number.isNaN(ms)) return ms / 1000;
  }
  return Date.now() / 1000;
}

/** Mesma regra da tela Conversas: por data, e a mensagem em envio por último. */
export function ordenarMensagens(lista: Message[]): Message[] {
  return [...lista].sort((a, b) => {
    const aEnvio = a.status === 'progress';
    const bEnvio = b.status === 'progress';
    if (aEnvio !== bEnvio) return aEnvio ? 1 : -1;
    return instanteDaMensagem(a) - instanteDaMensagem(b);
  });
}

/** Junta pelo id (a versão nova ganha: status, transcrição) e ordena. */
export function juntarMensagens(atuais: Message[], novas: Message[]): Message[] {
  const porId = new Map<string, Message>();
  for (const msg of atuais) porId.set(String(msg.id), msg);
  for (const msg of novas) porId.set(String(msg.id), msg);
  return ordenarMensagens([...porId.values()]);
}

/**
 * A página mais recente manda no trecho dela: o que está entre a mais antiga e a
 * mais nova da página e não veio nela foi apagado. O que é mais antigo (carregado
 * rolando pra cima) ou mais novo (chegou pelo tempo real depois do pedido) fica.
 */
export function aplicarPaginaRecente(atuais: Message[], pagina: Message[]): Message[] {
  if (pagina.length === 0) return [];
  const instantes = pagina.map(instanteDaMensagem);
  const inicio = Math.min(...instantes);
  const fim = Math.max(...instantes);
  const naPagina = new Set(pagina.map(msg => String(msg.id)));
  const fora = atuais.filter(msg => {
    if (naPagina.has(String(msg.id))) return false;
    const t = instanteDaMensagem(msg);
    return t < inicio || t > fim;
  });
  return juntarMensagens(fora, pagina);
}

/** Página cheia = provavelmente tem mais antigas; menos que isso = começo da conversa. */
export function temMaisAntigas(pagina: Message[]): boolean {
  return pagina.length >= TAMANHO_DA_PAGINA;
}

/**
 * getMessages já vem desembrulhado pra Message[] (extractData devolve
 * response.data.data); `{ data }`/`{ payload }` ficam por segurança.
 */
export function paginaDaResposta(raw: unknown): Message[] {
  if (Array.isArray(raw)) return raw as Message[];
  const r = raw as { data?: unknown; payload?: unknown } | null | undefined;
  if (Array.isArray(r?.data)) return r.data as Message[];
  if (Array.isArray(r?.payload)) return r.payload as Message[];
  return [];
}

/** Texto do erro do servidor (`error.message`, em português) ou o padrão. */
export function mensagemDoErro(e: unknown, padrao: string): string {
  const msg = (e as { response?: { data?: { error?: { message?: unknown } } } })?.response?.data?.error?.message;
  return typeof msg === 'string' && msg.trim() ? msg : padrao;
}
