import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import StartConversationModal from '@/components/contacts/StartConversationModal';
import { contactsService } from '@/services/contacts/contactsService';
import { Contact } from '@/types/contacts/contact';
import { PipelineItem } from '@/types/analytics/pipelines';

import { isValidUUID } from '@/utils/agentUtils';

/**
 * Campos que o PipelineItemSerializer manda mas o tipo do card não declara:
 * `conversation_id` sempre, e `whatsapp_conversation_id` para lead de
 * formulário/anúncio (a conversa de WhatsApp mais recente do contato).
 */
type LeadCardItem = PipelineItem & {
  conversation_id?: string | null;
  whatsapp_conversation_id?: string | null;
  contact_id?: string | null;
};

/**
 * Abre a conversa do lead DENTRO do LM Flow.
 *
 * O botão WhatsApp dos cards era um link `wa.me` que tirava o corretor do CRM: a
 * conversa acontecia fora, sem histórico, sem atribuição, sem nada do funil. O
 * padrão certo já existia no EditItemModal (`navigate('/conversations/<id>')`);
 * este hook é ele, num lugar só, para as três telas que mostram o card não
 * criarem uma quarta cópia da mesma lógica.
 *
 * Ordem de resolução do id da conversa — os quatro primeiros passos vêm do
 * CardConversationTab, que já resolvia isso; os dois últimos existem porque o
 * payload do kanban e o da sidebar são mais magros que o do card aberto:
 *
 *   1..4  o que veio no próprio item
 *   5     busca as conversas do contato (a mais recente)
 *   6     não há conversa nenhuma -> abre o modal de iniciar
 */
export function useOpenLeadConversation() {
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);
  const [startingFor, setStartingFor] = useState<Contact | null>(null);

  const goToConversation = useCallback(
    (id: string) => {
      navigate(`/conversations/${id}`);
    },
    [navigate],
  );

  const openLeadConversation = useCallback(
    async (item: PipelineItem) => {
      if (opening) return;

      const lead = item as LeadCardItem;

      // A rota /conversations/:id devolve para a lista, em silêncio, qualquer id
      // que não seja uuid (Chat.tsx). Um display_id aqui viraria "cliquei e não
      // aconteceu nada" — então id não-uuid não conta como encontrado e segue
      // para a busca no contato.
      const fromItem = [
        lead.conversation?.id,
        lead.conversation_id,
        lead.whatsapp_conversation_id,
        lead.type === 'conversation' ? lead.item_id : null,
      ]
        .filter(Boolean)
        .map(String)
        .find(isValidUUID);

      if (fromItem) {
        goToConversation(fromItem);
        return;
      }

      const contactId = lead.contact?.id || lead.contact_id;
      if (!contactId) {
        toast.error('Este lead não tem contato para abrir conversa');
        return;
      }

      setOpening(true);
      try {
        const conversations = await contactsService.getContactConversations(String(contactId), {
          status: 'all',
        });
        const existing = (conversations?.data || [])
          .map(conversation => String(conversation.id))
          .find(isValidUUID);

        if (existing) {
          goToConversation(existing);
          return;
        }

        // Lead de formulário/anúncio que ninguém abordou ainda. O modal precisa do
        // contato COMPLETO (canais disponíveis, telefone, e-mail); o `item.contact`
        // do card só traz nome/telefone/avatar.
        const contact = await contactsService.getContact(String(contactId));
        setStartingFor(contact);
      } catch (error) {
        // O 403 já vira toast no interceptor do api.ts; aqui cobre o resto, para
        // o clique nunca virar um no-op mudo (que era o defeito do link wa.me
        // quando o telefone estava fora do formato).
        console.error('[useOpenLeadConversation] falhou ao resolver a conversa', error);
        toast.error('Não consegui abrir a conversa deste lead');
      } finally {
        setOpening(false);
      }
    },
    [goToConversation, opening],
  );

  const startConversationModal = useMemo(() => {
    if (!startingFor) return null;

    return (
      <StartConversationModal
        open
        onOpenChange={open => {
          if (!open) setStartingFor(null);
        }}
        contact={startingFor}
        onConversationCreated={conversationId => {
          setStartingFor(null);
          goToConversation(conversationId);
        }}
      />
    );
  }, [goToConversation, startingFor]);

  return { openLeadConversation, startConversationModal, opening };
}

export default useOpenLeadConversation;
