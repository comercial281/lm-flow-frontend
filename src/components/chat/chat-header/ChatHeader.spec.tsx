import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ChatHeader from './ChatHeader';

// Este arquivo nasceu de um bug que só se vê rodando o produto: a janela
// "Ativar IA pra este lead" existia pronta, o endpoint existia, e o item de
// menu existia — só que num menu de conversa que NENHUMA tela renderizava. O
// menu de verdade, o dos três pontinhos no topo do chat, nunca teve o item. Do
// lado de fora, a funcionalidade simplesmente não existia.
//
// Ninguém percebe isso lendo o componente órfão (ele está correto). Só percebe
// quem procura pelo item no menu que o corretor realmente abre — que é o que
// este teste faz.

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

vi.mock('@evoapi/design-system/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@evoapi/design-system/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/chat/contact/ContactAvatar', () => ({
  default: () => <div />,
}));

// A janela é dublê: o que este teste garante é o CAMINHO até ela (o item existe
// no menu certo e abre a janela). O conteúdo da janela é assunto dela.
vi.mock('@/components/chat/conversation/ActivateAiDialog', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div>janela-ativar-ia</div> : null),
}));

vi.mock('@/features/numbers/useNumerosDaConversa', () => ({
  useNumerosDaConversa: () => ({
    // `name` é o identificador interno; o nome que o gestor deu é o `display_name`.
    inboxes: [
      { id: 'inbox-1', name: 'whatsapp-anuncios', display_name: 'WhatsApp Anúncios', phone_number: '+5511982350000' },
    ],
    numeros: null,
  }),
}));

const conversation = {
  id: 'conversation-1',
  status: 'open',
  contact: { name: 'Giovani' },
  inbox: { id: 'inbox-1', name: 'whatsapp-anuncios' },
  assignee: { name: 'Marina' },
  custom_attributes: {},
} as never;

const noop = () => {};

const renderHeader = (extra: { conversation?: unknown; emOferta?: boolean } = {}) =>
  render(
    <ChatHeader
      conversation={(extra.conversation ?? conversation) as never}
      emOferta={extra.emOferta}
      onBackClick={noop}
      onCloseConversation={noop}
      onContactSidebarOpen={noop}
      onMarkAsRead={noop}
      onMarkAsUnread={noop}
      onMarkAsOpen={noop}
      onMarkAsResolved={noop}
      onPostpone={noop}
      onMarkAsSnoozed={noop}
      onSetPriority={noop}
      onPinConversation={noop}
      onUnpinConversation={noop}
      onArchiveConversation={noop}
      onUnarchiveConversation={noop}
      onAssignAgent={noop}
      onAssignTeam={noop}
      onAssignTag={noop}
      onUnassignAgent={noop}
      onUnassignTeam={noop}
      onDeleteConversation={noop}
      unreadCount={0}
    />,
  );

describe('ChatHeader', () => {
  it('oferece "Ativar IA pra este lead" no menu da conversa', () => {
    renderHeader();

    expect(screen.getByText('Ativar IA pra este lead')).toBeTruthy();
  });

  it('abre a janela da IA ao clicar no item', () => {
    renderHeader();

    expect(screen.queryByText('janela-ativar-ia')).toBeNull();

    fireEvent.click(screen.getByText('Ativar IA pra este lead'));

    expect(screen.getByText('janela-ativar-ia')).toBeTruthy();
  });

  it('mostra número (o nome que o gestor deu, não o identificador), telefone e responsável, sem "Status"', () => {
    renderHeader();

    expect(
      screen.getByText('Número WhatsApp Anúncios · (11) 98235-0000 · Responsável: Marina'),
    ).toBeTruthy();
    expect(screen.queryByText(/Status/)).toBeNull();
  });

  it('na oferta da roleta, nome que é o telefone sai mascarado; fora dela, como veio', () => {
    const semNome = { ...(conversation as object), contact: { name: '+5511912345634' } };

    const { unmount } = renderHeader({ conversation: semNome, emOferta: true });
    expect(screen.getByText('(11) •••••-••34')).toBeTruthy();
    expect(screen.queryByText('+5511912345634')).toBeNull();
    unmount();

    renderHeader({ conversation: semNome, emOferta: false });
    expect(screen.getByText('+5511912345634')).toBeTruthy();
  });
});
