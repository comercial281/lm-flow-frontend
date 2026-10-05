import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

// O menu é achatado: submenus abertos, cada item um botão. O que este arquivo
// confere é QUAIS itens existem, em que ordem e o que cada um chama; abrir e
// fechar o submenu é assunto do Radix.
vi.mock('@evoapi/design-system/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="menu">{children}</div>,
  DropdownMenuPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuSub: ({ children }: { children: React.ReactNode }) => <div data-testid="submenu">{children}</div>,
  DropdownMenuSubTrigger: ({ children }: { children: React.ReactNode }) => (
    <div role="menuitem" aria-haspopup="menu">{children}</div>
  ),
  DropdownMenuSubContent: ({ children }: { children: React.ReactNode }) => <div role="menu">{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" role="menuitem" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuCheckboxItem: ({
    children,
    checked,
    disabled,
    onSelect,
  }: {
    children: React.ReactNode;
    checked?: boolean;
    disabled?: boolean;
    onSelect?: () => void;
  }) => (
    <button type="button" role="menuitemcheckbox" aria-checked={!!checked} disabled={disabled} onClick={onSelect}>
      {children}
    </button>
  ),
}));

let featureLigada = true;
vi.mock('@/contexts/TenantFeaturesContext', () => ({
  useFeature: () => featureLigada,
}));

// A janela de agendamento é a do card do lead; aqui é dublê.
vi.mock('@/components/scheduledActions/ScheduleActionModal', () => ({
  ScheduleActionModal: ({ contactId }: { contactId?: string }) => <div>{`janela-agendar:${contactId}`}</div>,
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
  priority: 'high',
  contact: { id: 77, name: 'Giovani' },
  inbox: { id: 'inbox-1', name: 'whatsapp-anuncios' },
  assignee: { name: 'Marina' },
  custom_attributes: {},
} as never;

const noop = () => {};

type Handlers = Partial<Record<string, (...a: unknown[]) => void>>;

const renderHeader = (extra: { conversation?: unknown; emOferta?: boolean; handlers?: Handlers } = {}) =>
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
      onUnassignAgent={noop}
      onUnassignTeam={noop}
      onDeleteConversation={noop}
      unreadCount={0}
      {...(extra.handlers ?? {})}
    />,
  );

beforeEach(() => {
  featureLigada = true;
});

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
    expect(screen.queryByText(/Status:/)).toBeNull();
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

  // ── Menu enxuto (04/10/2026) ──────────────────────────────────────────────
  describe('menu "⋮" enxuto', () => {
    const linhasDoMenu = () =>
      Array.from(screen.getByTestId('menu').children)
        .map(el => {
          if (el.getAttribute('data-testid') === 'submenu') {
            return el.querySelector('[aria-haspopup="menu"]')?.textContent ?? '';
          }
          return el.tagName === 'HR' ? '---' : (el.textContent ?? '');
        })
        .filter(Boolean);

    it('9 linhas na ordem combinada, sem "Atribuir etiqueta"', () => {
      renderHeader();
      expect(linhasDoMenu()).toEqual([
        'Agendar mensagem',
        'Ativar IA pra este lead',
        'chatHeader.actions.markAsUnread',
        'chatHeader.actions.markAsResolved',
        'Status',
        'Prioridade',
        'chatHeader.actions.pinConversation',
        'chatHeader.actions.archiveConversation',
        'Atribuir',
        '---',
        'chatHeader.actions.deleteConversation',
      ]);
      expect(screen.queryByText('chatHeader.actions.assignTag')).toBeNull();
      expect(screen.queryByText(/etiqueta/i)).toBeNull();
    });

    it('Status ▸ Pendente · Pausar conversa, com o ✓ no atual', () => {
      renderHeader({ conversation: { ...(conversation as object), status: 'snoozed' } });
      const status = screen.getByText('Status').closest('[data-testid="submenu"]') as HTMLElement;
      const pendente = within(status).getByRole('menuitemcheckbox', { name: 'Pendente' });
      const pausar = within(status).getByRole('menuitemcheckbox', { name: 'chatHeader.actions.pauseConversation' });
      expect(pendente.getAttribute('aria-checked')).toBe('false');
      expect(pausar.getAttribute('aria-checked')).toBe('true');
      // Pausada, o submenu também reabre.
      expect(within(status).getByText('Reabrir conversa')).toBeTruthy();
    });

    it('Status chama o mesmo handler de antes', () => {
      const onPostpone = vi.fn();
      const onMarkAsSnoozed = vi.fn();
      renderHeader({ handlers: { onPostpone, onMarkAsSnoozed } });
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Pendente' }));
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'chatHeader.actions.pauseConversation' }));
      expect(onPostpone).toHaveBeenCalledTimes(1);
      expect(onMarkAsSnoozed).toHaveBeenCalledTimes(1);
    });

    it('Prioridade ▸ Urgente · Alta · Média · Baixa, com o ✓ na atual', () => {
      const onSetPriority = vi.fn();
      renderHeader({ handlers: { onSetPriority } });
      const prioridade = screen.getByText('Prioridade').closest('[data-testid="submenu"]') as HTMLElement;
      const itens = within(prioridade).getAllByRole('menuitemcheckbox');
      expect(itens.map(i => i.textContent)).toEqual(['Urgente', 'Alta', 'Média', 'Baixa']);
      expect(itens.map(i => i.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false']);
      fireEvent.click(itens[0]);
      expect(onSetPriority).toHaveBeenCalledWith(expect.anything(), 'urgent');
      // Com prioridade, dá pra tirar.
      fireEvent.click(within(prioridade).getByText('chatHeader.actions.removePriority'));
      expect(onSetPriority).toHaveBeenLastCalledWith(expect.anything(), null);
    });

    it('Atribuir ▸ Atendente · Time · Desvincular corretor (só com corretor)', () => {
      const onAssignAgent = vi.fn();
      const onUnassignAgent = vi.fn();
      const { unmount } = renderHeader({ handlers: { onAssignAgent, onUnassignAgent } });
      let atribuir = screen.getByText('Atribuir').closest('[data-testid="submenu"]') as HTMLElement;
      expect(within(atribuir).getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Atribuir', 'Atendente', 'Time']);
      fireEvent.click(within(atribuir).getByText('Atendente'));
      expect(onAssignAgent).toHaveBeenCalledTimes(1);
      unmount();

      renderHeader({
        conversation: { ...(conversation as object), assignee_id: 5 },
        handlers: { onUnassignAgent },
      });
      atribuir = screen.getByText('Atribuir').closest('[data-testid="submenu"]') as HTMLElement;
      fireEvent.click(within(atribuir).getByText('chatHeader.actions.unassignAgent'));
      expect(onUnassignAgent).toHaveBeenCalledTimes(1);
    });

    it('resolvida, o "Marcar como resolvida" vira "Reabrir conversa"', () => {
      const onMarkAsOpen = vi.fn();
      renderHeader({ conversation: { ...(conversation as object), status: 'resolved' }, handlers: { onMarkAsOpen } });
      expect(screen.queryByText('chatHeader.actions.markAsResolved')).toBeNull();
      fireEvent.click(screen.getByText('Reabrir conversa'));
      expect(onMarkAsOpen).toHaveBeenCalledTimes(1);
    });

    it('Excluir conversa passa pelo handler da página (é lá que mora a permissão e a pergunta)', () => {
      const onDeleteConversation = vi.fn();
      renderHeader({ handlers: { onDeleteConversation } });
      fireEvent.click(screen.getByText('chatHeader.actions.deleteConversation'));
      expect(onDeleteConversation).toHaveBeenCalledTimes(1);
    });

    it('"Agendar mensagem" abre a janela de agendamento do card, com o lead', async () => {
      renderHeader();
      expect(screen.queryByText('janela-agendar:77')).toBeNull();
      fireEvent.click(screen.getByText('Agendar mensagem'));
      expect(await screen.findByText('janela-agendar:77')).toBeTruthy();
    });

    it('"Agendar mensagem" some na oferta da roleta e com a função desligada', () => {
      const { unmount } = renderHeader({ emOferta: true });
      expect(screen.queryByText('Agendar mensagem')).toBeNull();
      unmount();

      featureLigada = false;
      renderHeader();
      expect(screen.queryByText('Agendar mensagem')).toBeNull();
    });
  });
});
