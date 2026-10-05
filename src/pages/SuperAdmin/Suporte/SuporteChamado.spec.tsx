import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const svc = vi.hoisted(() => ({ show: vi.fn(), update: vi.fn(), reply: vi.fn(), archive: vi.fn(), entrarNoCliente: vi.fn() }));
vi.mock('@/services/support/supportAdminService', () => ({ supportAdminService: svc }));

import SuporteChamado from './SuporteChamado';
import { avisarSuporte } from '@/components/support/aoVivo';

const chamado = {
  id: 't1', kind: 'bug', status: 'open', subject: 'Roleta travou', faq_topic: null, page_url: '/automations/roleta',
  last_message_at: '2026-10-04T10:00:00Z', created_at: '2026-10-04T10:00:00Z', unread: false,
  tenant_slug: 'casa-x', user_name: 'Ana', user_email: 'ana@casa.test', admin_note: 'ver logs', tenant_id: 'ten-1',
  messages: [{ id: 'm1', author_side: 'customer', author_name: 'Ana', body: 'Travou tudo', created_at: '2026-10-04T10:00:00Z', images: [] }],
};

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/admin/suporte/t1']}>
      <Routes>
        <Route path="/admin/suporte/:id" element={<SuporteChamado />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Suporte — chamado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.show.mockResolvedValue(chamado);
    svc.reply.mockResolvedValue(chamado);
    svc.update.mockResolvedValue(chamado);
  });

  it('sinal ao vivo do chamado aberto recarrega na hora', async () => {
    montar();
    await screen.findByText('Travou tudo');
    const antes = svc.show.mock.calls.length;
    act(() => avisarSuporte('t1'));
    await waitFor(() => expect(svc.show.mock.calls.length).toBe(antes + 1));
  });

  it('mostra a conversa, a tela de origem e a nota interna', async () => {
    montar();
    expect(await screen.findByText('Travou tudo')).toBeInTheDocument();
    expect(screen.getByText('/automations/roleta')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ver logs')).toBeInTheDocument();
  });

  it('responder envia pelo time', async () => {
    montar();
    await screen.findByText('Travou tudo');
    fireEvent.change(screen.getByPlaceholderText('Responder o cliente'), { target: { value: 'Corrigido' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(svc.reply).toHaveBeenCalledWith('t1', 'Corrigido', [], undefined));
  });

  it('"Responder e resolver" manda já resolvendo', async () => {
    montar();
    await screen.findByText('Travou tudo');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Resolver ao enviar' }));
    fireEvent.change(screen.getByPlaceholderText('Responder o cliente'), { target: { value: 'Pronto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(svc.reply).toHaveBeenCalledWith('t1', 'Pronto', [], 'resolved'));
  });

  it('trocar a situação grava', async () => {
    montar();
    await screen.findByText('Travou tudo');
    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'resolved' } });
    await waitFor(() => expect(svc.update).toHaveBeenCalledWith('t1', { status: 'resolved' }));
  });

  it('salvar a nota interna', async () => {
    montar();
    const nota = await screen.findByDisplayValue('ver logs');
    fireEvent.change(nota, { target: { value: 'era cache' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nota' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalledWith('t1', { admin_note: 'era cache' }));
  });

  it('Entrar no cliente usa o SSO do cliente', async () => {
    svc.entrarNoCliente.mockResolvedValue('https://casa-x.lmflow.com.br/sso?t=1');
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    montar();
    await screen.findByText('Travou tudo');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar no cliente' }));
    await waitFor(() => expect(abrir).toHaveBeenCalledWith('https://casa-x.lmflow.com.br/sso?t=1', '_blank'));
  });

  it('o nome do item é o único h1 e o assunto fica em h2', async () => {
    montar();
    await screen.findByText('Travou tudo');
    expect(screen.getAllByRole('heading', { level: 1 }).map(h => h.textContent)).toEqual(['Suporte']);
    expect(screen.getByRole('heading', { level: 2, name: 'Roleta travou' })).toBeInTheDocument();
  });

  it('403 mostra o aviso de acesso restrito', async () => {
    svc.show.mockRejectedValue({ response: { status: 403, data: { error: 'Acesso restrito' } } });
    montar();
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Acesso restrito')).not.toBeInTheDocument();
  });
});
