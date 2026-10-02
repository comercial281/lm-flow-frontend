// AS PÍLULAS DA LISTA DE CONVERSAS: Todas · Minhas · Sem resposta · Arquivadas.
//
// Substituem o par Ativas/Arquivadas. "Minhas" e "Sem resposta" filtram NO
// SERVIDOR (assignee_type=me e waiting=true): o contador "20 / 110" e o
// "carregar mais" já vêm certos. "Arquivadas" continua sendo recorte da tela.
// A pílula soma aos filtros do popover e não é salva (a lista abre em "Todas").
// Textos literais de propósito (chave nova de t() não entra).

import type { BaseFilter } from '@/types/core';

export type Pilula = 'todas' | 'minhas' | 'sem_resposta' | 'arquivadas';

export const PILULAS: Array<{ id: Pilula; rotulo: string }> = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'minhas', rotulo: 'Minhas' },
  { id: 'sem_resposta', rotulo: 'Sem resposta' },
  { id: 'arquivadas', rotulo: 'Arquivadas' },
];

const filtro = (attributeKey: string, values: string): BaseFilter => ({
  attributeKey,
  filterOperator: 'equal_to',
  values,
  queryOperator: 'and',
  attributeModel: 'standard',
});

// Filtros que a pílula SOMA aos do popover. "Minhas" substitui qualquer
// responsável escolhido no popover.
export function filtrosComPilula(filtrosDoPopover: BaseFilter[], pilula: Pilula): BaseFilter[] {
  if (pilula === 'minhas') {
    return [...filtrosDoPopover.filter((f) => f.attributeKey !== 'assignee_id'), filtro('assignee_id', 'me')];
  }
  if (pilula === 'sem_resposta') {
    return [...filtrosDoPopover.filter((f) => f.attributeKey !== 'waiting'), filtro('waiting', 'true')];
  }
  return filtrosDoPopover;
}

// O inverso: o que o servidor devolve como filtro ativo inclui o da pílula;
// o popover só mostra (e reaplica) o que o usuário escolheu nele.
export function semFiltrosDaPilula(filtrosAtivos: BaseFilter[], pilula: Pilula): BaseFilter[] {
  return filtrosAtivos.filter((f) => {
    if (f.attributeKey === 'waiting') return false;
    if (pilula === 'minhas' && f.attributeKey === 'assignee_id' && String(f.values) === 'me') return false;
    return true;
  });
}

export function mostraArquivadas(pilula: Pilula): boolean {
  return pilula === 'arquivadas';
}

// Regra do PR #398: só a lista padrão (Todas, sem busca, só status=open) culpa
// o número de WhatsApp. Lista vazia por pílula, busca ou filtro não é culpa dele.
export function deveAvisarNumero(args: {
  pilula: Pilula;
  showArchived: boolean;
  busca: string;
  filtros: BaseFilter[];
}): boolean {
  const soFiltroPadrao = args.filtros.every(
    (f) => f.attributeKey === 'status' && String(f.values) === 'open',
  );
  return args.pilula === 'todas' && !args.showArchived && !args.busca && soFiltroPadrao;
}
