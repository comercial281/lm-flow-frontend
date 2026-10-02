import { MessageSquare, Phone } from 'lucide-react';
import { Contact } from '@/types/contacts';
import ContactAvatar from '@/components/chat/contact/ContactAvatar';
import { telefone } from '@/lib/formato';
import { Atendimento } from './ContactsTable';

interface Props {
  contact: Contact;
  onAbrir: (contact: Contact) => void;
  onConversa: (contact: Contact) => void;
}

// Contato no celular (fase 4): cartão em vez da tabela espremida. Nome,
// celular, por onde e com quem é atendido, e as duas ações que o corretor usa
// na rua — Ligar e WhatsApp — no mesmo desenho do card do funil no celular.
export default function ContactCartaoMovel({ contact, onAbrir, onConversa }: Props) {
  const numero = contact.phone_number;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <button type="button" onClick={() => onAbrir(contact)} className="flex w-full min-w-0 items-center gap-3 text-left">
        <ContactAvatar contact={contact} size="md" showColoredFallback={true} />
        <span className="min-w-0 flex-1">
          <span className="lm-redact block truncate text-sm font-medium">{contact.name || 'Sem nome'}</span>
          {numero && <span className="lm-redact block text-xs text-muted-foreground">{telefone(numero)}</span>}
        </span>
      </button>
      <div className="mt-2">
        <Atendimento contact={contact} />
      </div>
      {numero && (
        <div className="mt-3 flex items-center gap-1.5">
          <a
            href={`tel:${numero.replace(/[^\d+]/g, '')}`}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Phone className="h-3.5 w-3.5" />
            Ligar
          </a>
          {!contact.blocked && (
            <button
              type="button"
              onClick={() => onConversa(contact)}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              WhatsApp
            </button>
          )}
        </div>
      )}
    </div>
  );
}
