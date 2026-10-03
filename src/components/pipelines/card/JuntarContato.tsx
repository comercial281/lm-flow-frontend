import { useState } from 'react';
import { toast } from 'sonner';
import ContactMergeSelectorModal from '@/components/contacts/ContactMergeSelectorModal';
import ContactMergeModal from '@/components/contacts/ContactMergeModal';
import { contactsService } from '@/services/contacts/contactsService';
import type { Contact } from '@/types/contacts';

interface Props {
  contato: Contact;
  onFechar: () => void;
  /** Juntou: o contato aberto pode ter deixado de existir; quem abriu fecha o card. */
  onJuntado: () => void;
}

// "Juntar com outro contato" (menu ⋯ do card, só gestor). Veio da antiga
// Detalhes do Contato: escolhe o outro contato, depois quem fica.
export default function JuntarContato({ contato, onFechar, onJuntado }: Props) {
  const [outro, setOutro] = useState<Contact | null>(null);
  const [juntando, setJuntando] = useState(false);

  const confirmar = async (ficaId: string, saiId: string) => {
    setJuntando(true);
    try {
      await contactsService.mergeContacts({ base_contact_id: ficaId, mergee_contact_id: saiId });
      toast.success('Contatos juntados.');
      onJuntado();
    } catch {
      toast.error('Não consegui juntar os contatos.');
    } finally {
      setJuntando(false);
    }
  };

  return (
    <>
      <ContactMergeSelectorModal
        open={!outro}
        onOpenChange={aberto => { if (!aberto) onFechar(); }}
        currentContact={contato}
        onContactSelected={setOutro}
      />
      <ContactMergeModal
        open={!!outro}
        onOpenChange={aberto => { if (!aberto) onFechar(); }}
        contacts={outro ? [contato, outro] : []}
        onConfirm={confirmar}
        loading={juntando}
      />
    </>
  );
}
