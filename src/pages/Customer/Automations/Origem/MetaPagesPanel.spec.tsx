import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { MetaPage } from '@/services/integrations/metaPagesService';

const mocks = vi.hoisted(() => ({
  isSuper: false,
  getAll: vi.fn(),
  available: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  subscribeWebhook: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
}));

vi.mock('@/hooks/useIsSuperAdmin', () => ({
  useIsSuperAdmin: () => mocks.isSuper,
  SUPER_ADMIN_EMAIL: 'comercial@lealmidia.com.br',
}));

vi.mock('@/services/integrations/metaPagesService', () => ({
  metaPagesService: {
    getAll: (...a: unknown[]) => mocks.getAll(...a),
    available: (...a: unknown[]) => mocks.available(...a),
    create: (...a: unknown[]) => mocks.create(...a),
    update: (...a: unknown[]) => mocks.update(...a),
    remove: (...a: unknown[]) => mocks.remove(...a),
    subscribeWebhook: (...a: unknown[]) => mocks.subscribeWebhook(...a),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => mocks.toastSuccess(...a),
    error: (...a: unknown[]) => mocks.toastError(...a),
    warning: (...a: unknown[]) => mocks.toastWarning(...a),
  },
}));

import MetaPagesPanel from './MetaPagesPanel';

const page = (over: Partial<MetaPage>): MetaPage => ({
  id: 'uuid-a',
  page_id: '111',
  page_name: 'Imobiliária Centro',
  is_active: true,
  uses_own_token: false,
  has_token: true,
  webhook_subscribed: true,
  webhook_subscribed_at: '2026-09-12T10:00:00Z',
  connected_at: '2026-09-12T10:00:00Z',
  last_error: null,
  ...over,
});

const duasPaginas = [
  page({}),
  page({ id: 'uuid-b', page_id: '222', page_name: 'Lançamentos SP', is_active: false, webhook_subscribed: false }),
];

function renderPanel() {
  return render(
    <MemoryRouter>
      <MetaPagesPanel onGoToForms={() => {}} />
    </MemoryRouter>,
  );
}

// Erro no formato padrão da API ({ success: false, error: { code, message } }).
const apiError = (code: string, message: string) => ({
  response: { status: 422, data: { success: false, error: { code, message } } },
});

describe('MetaPagesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSuper = false;
    mocks.getAll.mockResolvedValue(duasPaginas);
  });

  it('lista as páginas com estado, e quem não é da Leal Mídia só olha', async () => {
    renderPanel();

    expect(await screen.findByText('Imobiliária Centro')).toBeInTheDocument();
    expect(screen.getByText('Lançamentos SP')).toBeInTheDocument();
    expect(screen.getByText('Ativa')).toBeInTheDocument();
    expect(screen.getByText('Desativada')).toBeInTheDocument();
    expect(screen.getByText('Recebimento em tempo real: ok')).toBeInTheDocument();
    expect(screen.getByText('Recebimento em tempo real: não ativado')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /Adicionar página/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remover/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Desativar' })).toBeNull();
  });

  it('leitura de fundo recusada não grita: texto discreto, sem toast', async () => {
    mocks.getAll.mockRejectedValue({ response: { status: 403, data: {} } });
    renderPanel();

    expect(await screen.findByText('Não foi possível carregar as páginas conectadas.')).toBeInTheDocument();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('super-admin escolhe a página da lista e ela é conectada', async () => {
    mocks.isSuper = true;
    mocks.available.mockResolvedValue([
      { page_id: '111', name: 'Imobiliária Centro', tasks: ['LEADS'], leads_ok: true, already_added: true },
      { page_id: '333', name: 'Nova Página', tasks: ['LEADS'], leads_ok: true, already_added: false },
    ]);
    mocks.create.mockResolvedValue(page({ id: 'uuid-c', page_id: '333', page_name: 'Nova Página' }));
    const usuario = userEvent.setup();
    renderPanel();

    await usuario.click(await screen.findByRole('button', { name: /Adicionar página/ }));
    await waitFor(() => expect(mocks.available).toHaveBeenCalledTimes(1));

    const jaConectada = await screen.findByRole('button', { name: 'Já conectada' });
    expect(jaConectada).toBeDisabled();

    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ page_id: '333', page_name: 'Nova Página' }));
    // A lista é recarregada depois de conectar — é ela que mostra a linha nova.
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalledTimes(2));
    expect(mocks.toastWarning).not.toHaveBeenCalled();
  });

  it('sem token de sistema, a janela abre direto no caminho manual (Page ID + token)', async () => {
    mocks.isSuper = true;
    mocks.available.mockRejectedValue(apiError('NO_TOKEN', 'Nenhum token de sistema disponível para listar páginas.'));
    mocks.create.mockResolvedValue(page({ id: 'uuid-d', page_id: '444', page_name: 'Manual', webhook_subscribed: false, last_error: 'sem acesso' }));
    const usuario = userEvent.setup();
    renderPanel();

    await usuario.click(await screen.findByRole('button', { name: /Adicionar página/ }));

    await usuario.type(await screen.findByLabelText('Page ID (Facebook)'), '444');
    await usuario.type(screen.getByLabelText('Nome da página'), 'Manual');
    await usuario.type(screen.getByLabelText('Access Token'), 'EAAtoken');
    await usuario.click(screen.getByRole('button', { name: 'Conectar página' }));

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({ page_id: '444', page_name: 'Manual', access_token: 'EAAtoken' }),
    );
    // Página conectada mas sem recebimento em tempo real: conectar não basta, e
    // o motivo do Facebook tem que chegar a quem clicou.
    await waitFor(() => expect(mocks.toastWarning).toHaveBeenCalledWith(expect.stringContaining('sem acesso')));
  });

  it('remover só acontece depois da confirmação', async () => {
    mocks.isSuper = true;
    mocks.remove.mockResolvedValue(undefined);
    const usuario = userEvent.setup();
    renderPanel();

    await usuario.click(await screen.findByRole('button', { name: 'Remover Imobiliária Centro' }));
    expect(mocks.remove).not.toHaveBeenCalled();

    await usuario.click(await screen.findByRole('button', { name: 'Remover' }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('uuid-a'));
  });

  it('religar recebimento mostra o motivo do servidor quando falha, nos dois formatos de erro', async () => {
    mocks.isSuper = true;
    mocks.getAll.mockResolvedValue([page({ webhook_subscribed: false, last_error: 'não inscrita' })]);
    // Recusa por cargo vem com `error` como TEXTO e a explicação em `message` —
    // o formato que a tela costuma ignorar e mostrar a frase genérica no lugar.
    mocks.subscribeWebhook.mockRejectedValue({
      response: { status: 403, data: { error: 'Forbidden', message: 'Seu cargo não permite esta ação' } },
    });
    const usuario = userEvent.setup();
    renderPanel();

    await usuario.click(await screen.findByRole('button', { name: 'Religar recebimento' }));

    await waitFor(() => expect(mocks.subscribeWebhook).toHaveBeenCalledWith('uuid-a'));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Seu cargo não permite esta ação'));
  });
});
