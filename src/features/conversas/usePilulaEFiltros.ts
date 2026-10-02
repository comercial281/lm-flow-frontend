// Dono do estado da lista de conversas: a pílula e os filtros do POPOVER.
// Mora na página (Chat.tsx), não na ChatSidebar, pra sobreviver ao remonte da
// lista. Os filtros do popover só mudam por quem os escolheu (aplicar/limpar
// do popover ou do modal); trocar de pílula nunca mexe neles. O que vai pro
// servidor é sempre `filtrosAplicados` = popover + pílula.

import { useCallback, useState } from 'react';
import type { BaseFilter } from '@/types/core';
import { filtrosComPilula, type Pilula } from './pilulas';

export function usePilulaEFiltros(filtrosIniciais: BaseFilter[] | (() => BaseFilter[])) {
  const [pilula, setPilula] = useState<Pilula>('todas');
  const [filtrosDoPopover, setFiltrosDoPopover] = useState<BaseFilter[]>(filtrosIniciais);

  const filtrosAplicados = useCallback(
    (meuId?: string | null, pilulaAtual: Pilula = pilula) =>
      filtrosComPilula(filtrosDoPopover, pilulaAtual, meuId),
    [filtrosDoPopover, pilula],
  );

  return { pilula, setPilula, filtrosDoPopover, setFiltrosDoPopover, filtrosAplicados };
}
