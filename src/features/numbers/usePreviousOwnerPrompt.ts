// Trocar o Dono do número (fase 2b.1) pergunta se o dono ANTERIOR sai também
// de Colaboradores — decisão do Tony: "pode ter um indicativo na hora pra
// clicar e confirmar isso". O sistema não tira ninguém sozinho.
//
// ⚠️ Este hook mora em `ChannelSettings`, NUNCA em `CollaboratorsForm`. O
// `onOwnerChange` do ChannelSettings chama `loadChannelData()`, que faz
// `setIsLoading(true)` e troca a página inteira pelo spinner — isso DESMONTA
// o `CollaboratorsForm` no meio do `await`. Um `useConfirmacao` chamado a
// partir de dentro do `CollaboratorsForm` fica preso numa instância morta: o
// `setPedido` roda num componente que já não existe, e o Dialog nunca aparece
// em produção (os specs antigos passavam porque `onOwnerChange` era mock e
// nunca desmontava nada de verdade). `ChannelSettings` sobrevive ao
// `isLoading`, então é ele quem tem que segurar o diálogo.

import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { useLanguage } from '@/hooks/useLanguage';
import { apiErrorMessage } from '@/utils/apiHelpers';
import InboxMembersService from '@/services/channels/inboxMembersService';
import {
  OWNER_TITLE,
  PREVIOUS_OWNER_KEEP,
  PREVIOUS_OWNER_REMOVE,
  previousOwnerPrompt,
} from './numberTexts';

export interface PreviousOwner {
  id: string;
  name: string;
}

export interface AskPreviousOwnerParams {
  /** A mesma leitura que `CollaboratorsForm` já usa (`useNumberOwnerRule`/`ownerRuleForChannel`). */
  rule: boolean;
  /** O dono GRAVADO antes da troca — vem do cartão do número (`numberCard?.owner`), lido ANTES do update. */
  previousOwner: PreviousOwner | null;
  /** O dono escolhido na troca (`null` = ficou sem dono / compartilhado). */
  newOwnerId: string | null;
}

interface UsePreviousOwnerPromptReturn {
  /** Chama depois que a troca de dono DEU CERTO no servidor. Resolve quando a pergunta (se houve) terminou. */
  ask: (params: AskPreviousOwnerParams) => Promise<void>;
  /** Renderizar no componente que NÃO desmonta durante o `loadChannelData` — fora do bloco trocado pelo spinner. */
  dialog: ReactNode;
}

export function usePreviousOwnerPrompt(inboxId: string): UsePreviousOwnerPromptReturn {
  const { t } = useLanguage('channels');
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const ask = async ({ rule, previousOwner, newOwnerId }: AskPreviousOwnerParams) => {
    // Nunca com a regra desligada, sem dono anterior, ou quando o "novo" é a
    // mesma pessoa que já era dona.
    if (!rule || !previousOwner || previousOwner.id === newOwnerId) return;

    const tirar = await confirmar({
      titulo: OWNER_TITLE,
      descricao: previousOwnerPrompt(previousOwner.name),
      rotuloDaAcao: PREVIOUS_OWNER_REMOVE,
      rotuloDeCancelar: PREVIOUS_OWNER_KEEP,
    });
    if (!tirar) return;

    try {
      await InboxMembersService.remove(inboxId, [previousOwner.id]);
    } catch (error) {
      console.error('Error removing previous number owner:', error);
      toast.error(apiErrorMessage(error, t('settings.collaborators.errors.updateError')));
    }
  };

  return { ask, dialog: dialogoDeConfirmacao };
}
