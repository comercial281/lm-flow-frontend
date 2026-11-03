/**
 * As PÁGINAS do Ensinar (Tarefa 75, 01/11/2026): 5 páginas, no mesmo arranjo do Configurar
 * (moldura/PaginasComTrilho). Fonte única de rótulo, frase, ícone e endereço (`?pagina=`).
 * Spec: LM FLOW/docs/superpowers/ia-reestruturacao/specs/2026-10-31-fase-6-tela-design.md §4.
 *
 * ⚠️ Endereços antigos: `instrucoes` → `casa`, `regras` → `licoes`, `prova` → `arquivos`
 * (link salvo, atalho do Painel e a mensagem que a equipe mandou continuam abrindo).
 */
import { BookOpen, FileText, FlaskConical, Home, MessageSquare, type LucideIcon } from 'lucide-react';
import type { OrigemDaLicao, TemaDaLicao } from '@/services/salesAgents/salesAgentsService';

export type PaginaDoEnsinar = 'licoes' | 'exemplos' | 'casa' | 'conhecimentos' | 'arquivos';

export const GRUPOS_DO_ENSINAR: { id: 'fala' | 'sabe'; rotulo: string; paginas: PaginaDoEnsinar[] }[] = [
  { id: 'fala', rotulo: 'Como ela fala', paginas: ['licoes', 'exemplos', 'casa'] },
  { id: 'sabe', rotulo: 'O que ela sabe', paginas: ['conhecimentos', 'arquivos'] },
];

export const PAGINAS_DO_ENSINAR: Record<PaginaDoEnsinar, { titulo: string; frase: string; icone: LucideIcon }> = {
  licoes: { titulo: 'Lições', frase: 'Cada lição diz quando e o que ela faz. Nasce de uma correção numa conversa ou é escrita por vocês.', icone: BookOpen },
  exemplos: { titulo: 'Exemplos', frase: 'Trechos de conversa pra ela pegar o ritmo: como responder e como não responder.', icone: MessageSquare },
  casa: { titulo: 'Regras e objeções da casa', frase: 'O que vale pra casa toda, escrito de fora: ordens curtas e como vocês respondem às objeções.', icone: Home },
  conhecimentos: { titulo: 'Conhecimentos de fábrica', frase: 'Escritos e revisados pela Leal Mídia. Ligam com o Produto; dá pra desligar um por um e abrir pra ler.', icone: FlaskConical },
  arquivos: { titulo: 'Arquivos e prova social', frase: 'O que ela consulta pra responder e os casos reais que pode citar.', icone: FileText },
};

/** Os assuntos de uma lição (lista fixa do servidor). Nulo = sem assunto. */
export const TEMAS: Record<TemaDaLicao, string> = {
  preco: 'Preço', tom: 'Tom', objecao: 'Objeção', visita: 'Visita', documento: 'Documento', abertura: 'Abertura', outro: 'Outro',
};

/** De onde veio a lição, nas palavras da tela. Cada origem tem o selo dela. */
export const ROTULO_DA_ORIGEM: Record<OrigemDaLicao, string> = {
  sugestao: 'Sugestão',
  correcao: 'Correção de conversa',
  equipe: 'Escrita pela equipe',
};

/** Teto de texto de uma lição/exemplo/caso: o mesmo do servidor (`SalesAgentLesson`, 4000), pra não voltar erro em inglês. */
export const LIMITE_DO_TEXTO = 4000;

/** Sem `?pagina=`: sempre Lições (as pendências chegam depois da lista; escolher por elas faria a tela pular). */
export const PAGINA_INICIAL_DO_ENSINAR: PaginaDoEnsinar = 'licoes';

const PAGINA_ANTIGA: Record<string, PaginaDoEnsinar> = { instrucoes: 'casa', regras: 'licoes', prova: 'arquivos' };

export function paginaDoEnsinarDaUrl(params: URLSearchParams): PaginaDoEnsinar | null {
  const p = params.get('pagina');
  if (!p) return null;
  // ⚠️ hasOwnProperty: `?pagina=constructor` não pode achar nada na cadeia do protótipo.
  const tem = (o: object) => Object.prototype.hasOwnProperty.call(o, p);
  if (tem(PAGINAS_DO_ENSINAR)) return p as PaginaDoEnsinar;
  return tem(PAGINA_ANTIGA) ? PAGINA_ANTIGA[p] : null;
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
