// ── A LISTA DE CONTATOS MORA NO ENDEREÇO (10/10/2026) ─────────────────────
//
// No celular o card do contato virou outra tela (a página do card completo), e
// Contatos sai da memória ao abrir. Voltar zerava a lista: busca, pílula,
// filtros e página moravam só na memória da tela. Agora moram no endereço
// (?busca=&pilula=&etiqueta=&sem=…&responsavel=&pagina=&por=), como o quadro do
// funil faz com aba e filtros: voltar (ou F5, ou mandar o link) traz a mesma
// lista. No computador a tela fica igual; só o endereço muda.

import { DEFAULT_PAGE_SIZE_OPTIONS } from '@/constants/pagination';
import { FILTROS_VAZIOS, type FiltrosDoPopover, type PilulaDeContatos } from './filtros';

export interface ListaDeContatosNoEndereco {
  busca: string;
  pilula: PilulaDeContatos;
  filtros: FiltrosDoPopover;
  pagina: number;
  /** null = o tamanho de página padrão. */
  porPagina: number | null;
}

const PILULAS = new Set<PilulaDeContatos>(['todos', 'meus', 'sem_responsavel']);
const CHAVES = ['busca', 'pilula', 'etiqueta', 'sem', 'responsavel', 'pagina', 'por'] as const;

const inteiroPositivo = (valor: string | null): number | null => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const tamanhoOferecido = (n: number | null): number | null =>
  n !== null && DEFAULT_PAGE_SIZE_OPTIONS.includes(n) ? n : null;

export function lerListaDoEndereco(sp: URLSearchParams): ListaDeContatosNoEndereco {
  const pilula = sp.get('pilula') as PilulaDeContatos | null;
  return {
    busca: sp.get('busca') ?? '',
    pilula: pilula && PILULAS.has(pilula) ? pilula : 'todos',
    filtros: {
      comEtiqueta: sp.get('etiqueta') ?? FILTROS_VAZIOS.comEtiqueta,
      semEtiquetas: sp.getAll('sem').filter(Boolean),
      responsavel: sp.get('responsavel') ?? FILTROS_VAZIOS.responsavel,
    },
    pagina: inteiroPositivo(sp.get('pagina')) ?? 1,
    // Só os tamanhos que o seletor da paginação oferece: ?por=100000 no link não
    // vira um pedido gigante ao servidor (outro valor cai no padrão).
    porPagina: tamanhoOferecido(inteiroPositivo(sp.get('por'))),
  };
}

/** Novo endereço com a lista; os outros parâmetros ficam. Valor padrão não vai pro endereço. */
export function comListaNoEndereco(atual: URLSearchParams, lista: ListaDeContatosNoEndereco): URLSearchParams {
  const novo = new URLSearchParams(atual);
  CHAVES.forEach(c => novo.delete(c));
  if (lista.busca) novo.set('busca', lista.busca);
  if (lista.pilula !== 'todos') novo.set('pilula', lista.pilula);
  if (lista.filtros.comEtiqueta) novo.set('etiqueta', lista.filtros.comEtiqueta);
  lista.filtros.semEtiquetas.forEach(e => novo.append('sem', e));
  if (lista.filtros.responsavel) novo.set('responsavel', lista.filtros.responsavel);
  if (lista.pagina > 1) novo.set('pagina', String(lista.pagina));
  if (lista.porPagina) novo.set('por', String(lista.porPagina));
  return novo;
}
