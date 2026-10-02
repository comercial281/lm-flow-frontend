import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { useLanguage } from '@/hooks/useLanguage';
import { useConversations } from '@/hooks/chat/useConversations';
import { contactsService } from '@/services/contacts/contactsService';
import ContactModal from '@/components/contacts/ContactModal';

import type { Contact } from '@/types/chat/api';
import type { Contact as FullContact, ContactFormData } from '@/types/contacts';

/**
 * A edição do contato no painel do lead: a mesma janela de Contatos, salvando
 * pelo mesmo serviço e atualizando o contato nas conversas abertas.
 */
export function useEditarContato(contact: Contact | null): { abrir: () => void; modal: ReactNode } {
  const { t } = useLanguage('chat');
  const { updateContactInConversations } = useConversations();
  const [aberto, setAberto] = useState(false);

  const salvar = async (data: ContactFormData) => {
    if (!contact?.id) return;

    try {
      const salvo = await contactsService.updateContact(contact.id, data);

      // O contato de Contatos (@/types/contacts) tem outro formato que o da conversa.
      const atualizado: Contact = {
        id: salvo.id,
        name: salvo.name,
        email: salvo.email || null,
        phone_number: salvo.phone_number || null,
        avatar: salvo.avatar || null,
        avatar_url: salvo.avatar_url || null,
        identifier: salvo.identifier || null,
        custom_attributes: salvo.custom_attributes || {},
        additional_attributes: (salvo.additional_attributes || {}) as Record<string, unknown>,
        contact_inboxes: (salvo.contact_inboxes || []) as unknown as Record<string, unknown>,
        location: null,
        country_code: null,
        blocked: salvo.blocked || false,
        last_activity_at: salvo.last_activity_at || '',
        created_at: salvo.created_at || '',
        updated_at: salvo.updated_at || '',
      };

      updateContactInConversations(atualizado);
      toast.success(t('contactSidebar.contactDetails.actions.updateSuccess'));
      setAberto(false);
    } catch (error) {
      console.error('Error saving contact:', error);
      toast.error(t('contactSidebar.contactDetails.actions.updateError'));
    }
  };

  const modal = contact ? (
    <ContactModal
      open={aberto}
      onOpenChange={setAberto}
      contact={contact as unknown as FullContact}
      isNew={false}
      loading={false}
      onSubmit={salvar}
    />
  ) : null;

  return { abrir: () => setAberto(true), modal };
}
