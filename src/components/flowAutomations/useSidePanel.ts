import { useCallback, useState } from 'react';
import type { PedidoDeConfirmacao } from '@/hooks/useConfirmacao';

// Qual painel lateral está aberto no canvas (sprint 4): o de um bloco ou o do
// Início. Um por vez. Trocar de painel (clicar em outro bloco, no Início, em
// Cancelar ou no X) com o rascunho mexido pergunta antes de descartar.

export type SidePanel = { type: 'node'; id: string } | { type: 'trigger' } | null;

export const PEDIDO_DESCARTAR_PAINEL: PedidoDeConfirmacao = {
  titulo: 'Descartar o que você mudou?',
  descricao: 'Você mexeu neste bloco e não clicou em Salvar. Se fechar agora, a mudança se perde.',
  rotuloDaAcao: 'Descartar',
  rotuloDeCancelar: 'Continuar editando',
  destrutivo: true,
};

function samePanel(a: SidePanel, b: SidePanel): boolean {
  if (!a || !b) return a === b;
  if (a.type !== b.type) return false;
  return a.type === 'trigger' || (b.type === 'node' && a.id === b.id);
}

export function useSidePanel(confirmar: (pedido: PedidoDeConfirmacao) => Promise<boolean>) {
  const [panel, setPanel] = useState<SidePanel>(null);
  const [dirty, setDirty] = useState(false);

  /** Pede pra trocar de painel (ou fechar, com null). Devolve se trocou. */
  const request = useCallback(async (next: SidePanel): Promise<boolean> => {
    if (samePanel(panel, next)) return true;
    if (dirty && !(await confirmar(PEDIDO_DESCARTAR_PAINEL))) return false;
    setDirty(false);
    setPanel(next);
    return true;
  }, [panel, dirty, confirmar]);

  /** Troca sem perguntar: depois do Salvar do painel, ou quando o bloco some. */
  const replace = useCallback((next: SidePanel) => {
    setDirty(false);
    setPanel(next);
  }, []);

  return { panel, dirty, setDirty, request, replace };
}
