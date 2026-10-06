import { useCallback } from 'react';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { PEDIDO_SAIR_SEM_SALVAR, temAlteracaoPendente } from '@/hooks/useAlteracoesNaoSalvas';

/**
 * Antes de trocar de aba (aba de ESTADO, que o `Abas` não guarda) ou de navegar
 * por um botão, pergunta se há alteração não salva — a mesma pergunta da guarda
 * do menu (`PEDIDO_SAIR_SEM_SALVAR`). Sem pendência, segue direto.
 */
export function usePodeSair() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const podeSair = useCallback(
    async () => !temAlteracaoPendente() || confirmar(PEDIDO_SAIR_SEM_SALVAR),
    [confirmar],
  );
  return { podeSair, dialogoDeSaida: dialogoDeConfirmacao };
}
