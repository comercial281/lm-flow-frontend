import { useEffect, useState } from 'react';
import MessageTemplateService from '@/services/channels/messageTemplatesService';

// O botão "Modelos de mensagem" só aparece quando o número da conversa tem ao
// menos um modelo (08/10/2026, pedido do Tony): quase ninguém tem, e o botão
// abria só pra dizer "nenhum modelo". Uma consulta por número enquanto a página
// vive (trocar de conversa no mesmo número não pergunta de novo). Se a consulta
// falha, o botão fica escondido: sem modelo não há o que enviar.

const cache = new Map<string, Promise<boolean>>();

function consultar(inboxId: string): Promise<boolean> {
  let pendente = cache.get(inboxId);
  if (!pendente) {
    pendente = MessageTemplateService.getTemplates(inboxId, { per_page: 1 })
      .then(r => (r?.data?.length ?? 0) > 0)
      .catch(() => {
        cache.delete(inboxId);
        return false;
      });
    cache.set(inboxId, pendente);
  }
  return pendente;
}

export function useTemModelos(inboxId: string | undefined, ligado: boolean): boolean {
  const [tem, setTem] = useState(false);

  useEffect(() => {
    setTem(false);
    if (!ligado || !inboxId) return;
    let vivo = true;
    consultar(inboxId).then(v => {
      if (vivo) setTem(v);
    });
    return () => {
      vivo = false;
    };
  }, [inboxId, ligado]);

  return tem;
}

/** Só pros testes: esquece o que já foi consultado. */
export function _limparCacheDeModelos() {
  cache.clear();
}
