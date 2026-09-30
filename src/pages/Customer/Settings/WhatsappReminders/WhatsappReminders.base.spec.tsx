import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Tela piloto da Fase 3: cada teste aqui é uma regra da base de design que a
// fase 4 vai levar pras outras telas.

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/services/whatsappReminders', () => ({
  whatsappRemindersService: {
    list: (...a: unknown[]) => mocks.list(...a),
    update: (...a: unknown[]) => mocks.update(...a),
    remove: (...a: unknown[]) => mocks.remove(...a),
    listGroups: vi.fn().mockResolvedValue([]),
    execute: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));
vi.mock('@/services/core/api', () => ({ default: { get: vi.fn().mockRejectedValue(new Error('not mocked')) } }));

import WhatsappReminders from './WhatsappReminders';

const LEMBRETE = {
  id: 'r1',
  name: 'Avisar comercial',
  enabled: true,
  trigger_type: 'manual_macro',
  delivery_mode: 'immediate',
  destination_type: 'group',
  inbox_id: 3,
  inbox_name: 'Comercial',
  content_mode: 'editor_vars',
  content_template: 'Olá {{nome}}',
};

describe('Lembretes na base da Fase 3', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cabeçalho da casa com o nome da aba e a ação principal', async () => {
    mocks.list.mockResolvedValue({ data: [] });
    render(<WhatsappReminders />);
    expect(screen.getByRole('heading', { level: 1, name: 'Lembretes' })).toBeInTheDocument();
    expect(await screen.findAllByRole('button', { name: 'Novo lembrete' })).not.toHaveLength(0);
  });

  it('vazio ensina pra que serve, com exemplo', async () => {
    mocks.list.mockResolvedValue({ data: [] });
    render(<WhatsappReminders />);
    expect(await screen.findByText('Nenhum lembrete ainda')).toBeInTheDocument();
    expect(screen.getByText('Avisar o comercial sobre um lead novo')).toBeInTheDocument();
  });

  it('não carregou: estado de erro com "Tentar de novo", nunca a lista vazia', async () => {
    mocks.list.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce({ data: [LEMBRETE] });
    render(<WhatsappReminders />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum lembrete ainda')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Avisar comercial')).toBeInTheDocument();
  });

  it('a chave da lista grava só o "ligado", na hora', async () => {
    mocks.list.mockResolvedValue({ data: [LEMBRETE] });
    mocks.update.mockResolvedValue({});
    render(<WhatsappReminders />);
    const chave = await screen.findByRole('switch', { name: 'Lembrete Avisar comercial' });
    await userEvent.click(chave);
    expect(mocks.update).toHaveBeenCalledWith('r1', { enabled: false });
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith('Desligado'));
  });

  it('Excluir mora no menu "…" e pede confirmação', async () => {
    mocks.list.mockResolvedValue({ data: [LEMBRETE] });
    mocks.remove.mockResolvedValue(undefined);
    render(<WhatsappReminders />);
    await userEvent.click(await screen.findByRole('button', { name: 'Mais ações de Avisar comercial' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Excluir' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Excluir lembrete')).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('r1'));
  });

  it('botões de ícone têm nome', async () => {
    mocks.list.mockResolvedValue({ data: [LEMBRETE] });
    render(<WhatsappReminders />);
    expect(await screen.findByRole('button', { name: 'Mandar agora' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });
});
