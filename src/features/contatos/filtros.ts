// OS FILTROS DA LISTA DE CONTATOS (fase 4, 02/10/2026): mesmo desenho de
// Conversas — pílulas no topo + um "Filtros" fechado.
//
// Pílulas: Todos · Meus · Sem responsável. Só o gestor vê: o corretor já recebe
// do servidor só os contatos dele, e "Meus" seria igual a "Todos".
// No popover: com a etiqueta, sem as etiquetas e (gestor) o responsável.
// Cidade e Empresa saíram — imobiliária não filtra cliente por isso.
//
// Tudo vira linha do POST /contacts/filter. A pílula soma aos do popover e
// SUBSTITUI o responsável escolhido lá (as duas falam da mesma coisa).
// Textos literais de propósito (chave nova de t() não entra).

import type { BaseFilter } from '@/types/core';

export type PilulaDeContatos = 'todos' | 'meus' | 'sem_responsavel';

export const PILULAS_DE_CONTATOS: Array<{ id: PilulaDeContatos; rotulo: string }> = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'meus', rotulo: 'Meus' },
  { id: 'sem_responsavel', rotulo: 'Sem responsável' },
];

export const RESPONSAVEL = 'default_assignee_id';

/** Escolhas do popover. Vazio = sem aquele filtro. */
export interface FiltrosDoPopover {
  comEtiqueta: string;
  semEtiquetas: string[];
  /** id do usuário, ou SEM_RESPONSAVEL. */
  responsavel: string;
}

export const SEM_RESPONSAVEL = '__sem_responsavel__';

export const FILTROS_VAZIOS: FiltrosDoPopover = { comEtiqueta: '', semEtiquetas: [], responsavel: '' };

const linha = (attributeKey: string, filterOperator: string, values: string | string[]): BaseFilter => ({
  attributeKey,
  filterOperator,
  values,
  queryOperator: 'and',
  attributeModel: 'standard',
});

const linhaDoResponsavel = (valor: string): BaseFilter =>
  valor === SEM_RESPONSAVEL ? linha(RESPONSAVEL, 'is_not_present', []) : linha(RESPONSAVEL, 'equal_to', valor);

/** Quantos filtros do popover estão ligados (o número no botão "Filtros"). */
export function quantosFiltros(f: FiltrosDoPopover): number {
  return (f.comEtiqueta ? 1 : 0) + (f.semEtiquetas.length ? 1 : 0) + (f.responsavel ? 1 : 0);
}

export function linhasDoFiltro(
  f: FiltrosDoPopover,
  pilula: PilulaDeContatos,
  meuId?: string | null,
): BaseFilter[] {
  const linhas: BaseFilter[] = [];
  if (f.comEtiqueta) linhas.push(linha('labels', 'equal_to', f.comEtiqueta));
  if (f.semEtiquetas.length) linhas.push(linha('labels', 'not_equal_to', f.semEtiquetas));

  if (pilula === 'meus' && meuId) linhas.push(linhaDoResponsavel(String(meuId)));
  else if (pilula === 'sem_responsavel') linhas.push(linhaDoResponsavel(SEM_RESPONSAVEL));
  else if (f.responsavel) linhas.push(linhaDoResponsavel(f.responsavel));

  return linhas;
}
