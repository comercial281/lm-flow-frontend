import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ds';
import { Contact, ContactFormData } from '@/types/contacts';
import ContactForm from './ContactForm';

interface ContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact;
  isNew?: boolean;
  loading?: boolean;
  onSubmit: (data: ContactFormData) => void;
}

export default function ContactModal({
  open,
  onOpenChange,
  contact,
  isNew = false,
  loading = false,
  onSubmit,
}: ContactModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* A rolagem mora dentro do formulário, pra o rodapé com Salvar ficar fixo. */}
      <DialogContent className="max-w-2xl max-h-[90dvh] gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-xl">{isNew ? 'Novo contato' : 'Editar contato'}</DialogTitle>
        </DialogHeader>

        <ContactForm
          contact={contact}
          isNew={isNew}
          loading={loading}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
