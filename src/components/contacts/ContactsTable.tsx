import { useLanguage } from '@/hooks/useLanguage';
import { MessageSquare, Edit, Trash2, Users, Activity, Smartphone } from 'lucide-react';
import { Contact } from '@/types/contacts';
import { BaseTable, TableColumn, TableAction } from '@/components/base';
import ContactAvatar from '@/components/chat/contact/ContactAvatar';
import ContactTagsList from './ContactTagsList';
import InicialDoCorretor from './InicialDoCorretor';
import { quandoMudou, telefone, VAZIO } from '@/lib/formato';

interface ContactsTableProps {
  contacts: Contact[];
  selectedContacts: Contact[];
  loading?: boolean;
  onSelectionChange: (contacts: Contact[]) => void;
  onContactClick: (contact: Contact) => void;
  onStartConversation: (contact: Contact) => void;
  onEditContact: (contact: Contact) => void;
  onDeleteContact: (contact: Contact) => void;
  onViewEvents?: (contact: Contact) => void;
  onCreateContact?: () => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (column: string) => void;
}

// Por qual NÚMERO o contato é atendido. O backend manda os vínculos do MAIS
// RECENTE para o mais antigo, na mesma ordem que o OutboundInboxResolver usa
// para escolher por onde a mensagem sai: o primeiro é "por onde fala hoje" —
// o que muda quando a roleta abre o atendimento noutro número.
export function numerosDoContato(contact: Contact): string[] {
  const vinculos = (contact.contact_inboxes ?? []) as Array<{ inbox?: { name?: string } }>;
  return Array.from(new Set(vinculos.map(v => v?.inbox?.name).filter((n): n is string => !!n)));
}

/**
 * Coluna Atendimento (decisão do dono, 02/10/2026): número e corretor lado a
 * lado — quase sempre o número é o do próprio corretor, então juntos se lê
 * "por onde e com quem" de uma vez. Telefone pequeno + nome do número, uma
 * barra, e a foto (ou inicial) do responsável.
 */
export function Atendimento({ contact }: { contact: Contact }) {
  const nomes = numerosDoContato(contact);
  const dono = contact.default_assignee;
  // O tooltip separa o atual dos anteriores: sem isso, "+1" não diz se o outro
  // número é um histórico ou um segundo canal ativo.
  const tituloNumero =
    nomes.length > 1
      ? `Atende por ${nomes[0]} — também passou por ${nomes.slice(1).join(', ')}`
      : nomes.length === 1
        ? `Atende por ${nomes[0]}`
        : 'Ainda não falou por nenhum número';

  return (
    <div className="flex min-w-0 items-center gap-2 text-xs">
      <span className="flex min-w-0 items-center gap-1" title={tituloNumero}>
        <Smartphone className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className={`truncate ${nomes.length ? '' : 'text-muted-foreground'}`}>
          {nomes[0] ?? VAZIO}
          {nomes.length > 1 && <span className="text-muted-foreground"> +{nomes.length - 1}</span>}
        </span>
      </span>
      <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
      {dono ? (
        <span className="flex min-w-0 items-center gap-1.5" title={`Responsável: ${dono.name}`}>
          <InicialDoCorretor nome={dono.name} fotoUrl={dono.avatar_url} />
          <span className="truncate">{dono.name.split(' ')[0]}</span>
        </span>
      ) : (
        <span className="whitespace-nowrap text-muted-foreground">Sem responsável</span>
      )}
    </div>
  );
}

export default function ContactsTable({
  contacts,
  selectedContacts,
  loading,
  onSelectionChange,
  onContactClick,
  onStartConversation,
  onEditContact,
  onDeleteContact,
  onViewEvents,
  onCreateContact,
  sortBy,
  sortOrder,
  onSort,
}: ContactsTableProps) {
  const { t } = useLanguage('contacts');

  // Lista enxuta (fase 4, 02/10/2026): saíram Tipo e Status (sempre "Pessoa" e
  // "Ativo") e Pipelines (quase sempre vazia — a etapa se vê no funil e no card).
  // Nome e celular em colunas separadas.
  const columns: TableColumn<Contact>[] = [
    {
      key: 'name',
      label: 'Nome',
      sortable: true,
      render: contact => (
        <button
          type="button"
          className="flex min-w-0 items-center gap-3 py-1 text-left hover:opacity-80"
          onClick={() => onContactClick(contact)}
        >
          <ContactAvatar contact={contact} size="sm" showColoredFallback={true} />
          <span className="lm-redact truncate text-sm font-medium">{contact.name || t('table.noName')}</span>
        </button>
      ),
    },
    {
      key: 'phone_number',
      label: 'Celular',
      sortable: false,
      width: 'w-40',
      render: contact => (
        <span className="lm-redact whitespace-nowrap text-sm">
          {contact.phone_number ? telefone(contact.phone_number) : VAZIO}
        </span>
      ),
    },
    {
      key: 'atendimento',
      label: 'Atendimento',
      sortable: false,
      width: 'w-64',
      render: contact => <Atendimento contact={contact} />,
    },
    {
      key: 'labels',
      label: 'Etiquetas',
      sortable: false,
      render: contact => <ContactTagsList labels={contact.labels} maxVisible={2} size="sm" />,
    },
    {
      key: 'updated_at',
      label: 'Atualizado em',
      sortable: false,
      width: 'w-32',
      render: contact => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{quandoMudou(contact.updated_at)}</span>
      ),
    },
  ];

  const actions: TableAction<Contact>[] = [
    {
      label: t('table.actions.startConversation'),
      icon: <MessageSquare className="h-4 w-4" />,
      onClick: onStartConversation,
      show: contact => !contact.blocked,
    },
    {
      label: t('table.actions.viewEvents'),
      icon: <Activity className="h-4 w-4" />,
      onClick: onViewEvents!,
      show: () => !!onViewEvents,
    },
    {
      label: t('table.actions.edit'),
      icon: <Edit className="h-4 w-4" />,
      onClick: onEditContact,
    },
    {
      label: t('table.actions.delete'),
      icon: <Trash2 className="h-4 w-4" />,
      onClick: onDeleteContact,
      variant: 'destructive' as const,
    },
  ];

  return (
    <BaseTable<Contact>
      data={contacts || []}
      columns={columns}
      actions={actions}
      selectable
      selectedItems={selectedContacts}
      onSelectionChange={onSelectionChange}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={onSort}
      loading={loading}
      emptyMessage={t('table.empty.noResults')}
      emptyIcon={Users}
      emptyTitle={t('table.empty.title')}
      emptyDescription={t('table.empty.description')}
      emptyAction={onCreateContact ? { label: t('table.actions.create'), onClick: onCreateContact } : undefined}
      getRowKey={contact => String(contact.id)}
    />
  );
}
