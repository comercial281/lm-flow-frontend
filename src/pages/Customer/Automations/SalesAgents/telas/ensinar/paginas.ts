/**
 * As PÁGINAS do Ensinar (11/10/2026): 2 grupos, 5 páginas, no mesmo arranjo do
 * Configurar (moldura/PaginasComTrilho). Fonte única de rótulo, frase, ícone e
 * endereço (`?pagina=`), e das pendências do trilho.
 * Spec: LM FLOW/specs/2026-10-11-ia-ensinar-refatoracao-design.md §2.
 */
import { AlignLeft, FileText, MessageSquare, SquareCheck, Star, type LucideIcon } from 'lucide-react';
import type { SalesAgentDocument, SalesAgentLesson } from '@/services/salesAgents/salesAgentsService';

export type PaginaDoEnsinar = 'instrucoes' | 'regras' | 'exemplos' | 'arquivos' | 'prova';

export const GRUPOS_DO_ENSINAR: { id: 'fala' | 'sabe'; rotulo: string; paginas: PaginaDoEnsinar[] }[] = [
  { id: 'fala', rotulo: 'Como ela fala', paginas: ['instrucoes', 'regras', 'exemplos'] },
  { id: 'sabe', rotulo: 'O que ela sabe', paginas: ['arquivos', 'prova'] },
];

export const PAGINAS_DO_ENSINAR: Record<PaginaDoEnsinar, { titulo: string; frase: string; icone: LucideIcon }> = {
  instrucoes: { titulo: 'Instruções', frase: 'O contexto da casa em texto corrido: quem vocês são, o tom e o que ela precisa saber.', icone: AlignLeft },
  regras: { titulo: 'Regras', frase: 'Ordens curtas que ela segue à risca. Dá pra pausar e voltar quando quiser.', icone: SquareCheck },
  exemplos: { titulo: 'Exemplos', frase: 'Trechos de conversa pra ela pegar o ritmo: como responder e como não responder.', icone: MessageSquare },
  arquivos: { titulo: 'Arquivos', frase: 'O que ela consulta pra responder e o que pode mandar pro lead.', icone: FileText },
  prova: { titulo: 'Prova social', frase: 'Casos reais que ela pode citar pra gerar confiança.', icone: Star },
};

/** Sem `?pagina=`: sempre Instruções (as pendências chegam depois da lista; escolher por elas faria a tela pular). */
export const PAGINA_INICIAL_DO_ENSINAR: PaginaDoEnsinar = 'instrucoes';

export function paginaDoEnsinarDaUrl(params: URLSearchParams): PaginaDoEnsinar | null {
  const p = params.get('pagina');
  // ⚠️ hasOwnProperty: `?pagina=constructor` não pode achar nada na cadeia do protótipo.
  return p && Object.prototype.hasOwnProperty.call(PAGINAS_DO_ENSINAR, p) ? (p as PaginaDoEnsinar) : null;
}

/** Regras ligadas que o servidor diz que NÃO entram no prompt (passaram do limite). */
export function regrasForaDoLimite(licoes: SalesAgentLesson[]): number {
  return licoes.filter((l) => l.kind === 'rule' && l.enabled && !l.in_use).length;
}

/** Arquivo que pode ir pro lead sem dizer quando: ela não sabe a hora de mandar. */
export function arquivosSemQuando(docs: SalesAgentDocument[]): number {
  return docs.filter((d) => d.sendable && !(d.send_when ?? '').trim()).length;
}

/** Prova social: um caso por linha, no mesmo campo de texto (decisão 4 do spec). */
export function casosDe(texto: string | null | undefined): string[] {
  return (texto ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
}

export function textoDosCasos(casos: string[]): string | null {
  const limpos = casos.map((s) => s.trim()).filter(Boolean);
  return limpos.length ? limpos.join('\n') : null;
}

/** Conversa real como o servidor a lê, com o índice CRU no `example_conversations` (pra editar/excluir a certa). */
export interface ConversaReal { indice: number; lead: string; resposta: string }

/**
 * Espelho de `SalesAgent#example_conversations_list` (servidor): o comando só vê as
 * conversas que sobram dessa leitura, e o limite (`limites.conversations`) conta só
 * elas. Objeto: `resposta` (senão `reply`; como o `||` do Ruby, texto vazio NÃO cai pro
 * `reply`), sem espaço nas pontas; resposta vazia sai. Texto solto: vira a resposta,
 * sem lead. Qualquer outra coisa sai.
 */
export function conversasReais(cru: unknown): ConversaReal[] {
  if (!Array.isArray(cru)) return [];
  const texto = (v: unknown) => (v === null || v === undefined || v === false ? '' : String(v)).trim();
  const ou = (a: unknown, b: unknown) => (a === null || a === undefined || a === false ? b : a);
  const lidas: ConversaReal[] = [];
  cru.forEach((ex, indice) => {
    if (typeof ex === 'string') {
      const resposta = ex.trim();
      if (resposta) lidas.push({ indice, lead: '', resposta });
    } else if (ex && typeof ex === 'object' && !Array.isArray(ex)) {
      const o = ex as Record<string, unknown>;
      const resposta = texto(ou(o.resposta, o.reply));
      if (resposta) lidas.push({ indice, lead: texto(o.lead), resposta });
    }
  });
  return lidas;
}
