import type { ClientePooled } from '@/types/admin/clientes';
import type { Atencao, ClienteComProblema, Problema } from '@/types/admin/overview';

// Regras da lista de Clientes: ordem, filtros e o selo de problema que vem da
// Atenção da Visão Geral. Ficam aqui, puras, pra teste.
// Gente da Leal Mídia dentro do cliente (suporte/entrar como): não conta como "do cliente".
export const EQUIPE = /@lealmidia\.com\.br$/i;

export type FiltroLista = 'todos' | 'com_problema' | 'arquivados';
const FILTROS: FiltroLista[] = ['todos', 'com_problema', 'arquivados'];

export function filtroValido(v: string | null): FiltroLista {
  return FILTROS.includes(v as FiltroLista) ? (v as FiltroLista) : 'todos';
}

// O Principal não tem slug: casa pelo schema ('public').
export function chaveDoCliente(t: Pick<ClientePooled, 'slug' | 'schema_name'>): string {
  return t.schema_name === 'public' ? 'public' : t.slug;
}

export function problemasPorCliente(atencao: Atencao | null): Map<string, ClienteComProblema> {
  const mapa = new Map<string, ClienteComProblema>();
  for (const c of atencao?.clients ?? []) mapa.set(c.slug ?? c.schema, c);
  return mapa;
}

export function ordenarCartoes(lista: ClientePooled[], problemas: Map<string, ClienteComProblema>): ClientePooled[] {
  const peso = (t: ClientePooled) => {
    const p = problemas.get(chaveDoCliente(t));
    return p ? (p.severity === 'vermelho' ? 0 : 1) : 2;
  };
  return [...lista].sort((a, b) => peso(a) - peso(b) || a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
}

export function filtrarCartoes(lista: ClientePooled[], filtro: FiltroLista, busca: string, problemas: Map<string, ClienteComProblema>): ClientePooled[] {
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  return lista.filter((t) => {
    if (filtro === 'com_problema' && !problemas.has(chaveDoCliente(t))) return false;
    return !termo || t.name.toLocaleLowerCase('pt-BR').includes(termo);
  });
}

function textoCurto(p: Problema): string {
  switch (p.kind) {
    case 'numero_caido': return p.numbers.length === 1 ? '1 número caído' : `${p.numbers.length} números caídos`;
    case 'erro_criacao': return 'Erro na criação';
    case 'ia_falhando': return 'IA falhando';
    case 'custo_ia_alto': return 'Custo da IA alto';
    case 'aviso_nao_chega': return 'Aviso não chega';
    case 'chamado_sem_resposta': return 'Chamado sem resposta';
    default: return 'Precisa de atenção';
  }
}

// Selo do cartão: o problema mais grave (o servidor já manda na ordem).
export function seloDeProblema(c: ClienteComProblema): string {
  return c.problems[0] ? textoCurto(c.problems[0]) : 'Precisa de atenção';
}
