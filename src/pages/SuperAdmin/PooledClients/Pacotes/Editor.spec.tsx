import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));

import Editor from './Editor';

const pacote = { id: 'p1', name: 'Completo', clients_count: 2, features_on: 1,
  limits: { max_whatsapp_channels: 5, ai_leads_included: null, ai_lead_overage_price_brl: 2.49 },
  features: { disparos: false }, catalog: [{ key: 'disparos', label: 'Disparos', group: 'disparos', theme: 'automacoes', theme_label: 'Automações' }],
  clients: [{ id: 'c1', name: 'A' }, { id: 'c2', name: 'B' }] };

const montar = () => render(<MemoryRouter initialEntries={['/admin/clientes/pacotes/p1']}>
  <Routes><Route path="/admin/clientes/pacotes/:id" element={<Editor />} /></Routes></MemoryRouter>);

describe('Editor de pacote', () => {
  beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); api.get.mockResolvedValue({ data: { data: pacote } }); });

  it('salvar mostra a prévia e aplica aos clientes', async () => {
    api.post.mockResolvedValue({ data: { data: { clients_count: 2, changes: { features: [{ key: 'disparos', label: 'Disparos', from: false, to: true }], limits: [] } } } });
    api.patch.mockResolvedValue({ data: { data: pacote, result: { applied: 2, failed: [], clients_count: 2, changes: {} } } });
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole('switch', { name: 'Disparos' }));
    await user.click(screen.getByRole('button', { name: 'Salvar pacote' }));
    expect(await screen.findByText('Aplicar aos 2 clientes deste pacote?')).toBeInTheDocument();
    expect(screen.getByText('liga Disparos')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salvar e aplicar' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/super/packages/p1', expect.objectContaining({ apply_to_clients: true, features: { disparos: true } })));
  });

  it('com 1 cliente o título da prévia fica no singular', async () => {
    api.get.mockResolvedValue({ data: { data: { ...pacote, clients_count: 1, clients: [{ id: 'c1', name: 'A' }] } } });
    api.post.mockResolvedValue({ data: { data: { clients_count: 1, changes: { features: [{ key: 'disparos', label: 'Disparos', from: false, to: true }], limits: [] } } } });
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole('switch', { name: 'Disparos' }));
    await user.click(screen.getByRole('button', { name: 'Salvar pacote' }));
    expect(await screen.findByText('Aplicar ao 1 cliente deste pacote?')).toBeInTheDocument();
  });

  it('salvar sem aplicar', async () => {
    api.post.mockResolvedValue({ data: { data: { clients_count: 2, changes: { features: [], limits: [{ key: 'max_whatsapp_channels', from: 5, to: 3 }] } } } });
    api.patch.mockResolvedValue({ data: { data: pacote, result: null } });
    const user = userEvent.setup();
    montar();
    const campo = await screen.findByLabelText('Números de WhatsApp');
    await user.clear(campo); await user.type(campo, '3');
    await user.click(screen.getByRole('button', { name: 'Salvar pacote' }));
    await user.click(await screen.findByRole('button', { name: 'Só salvar o pacote' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/super/packages/p1', expect.objectContaining({ apply_to_clients: false })));
  });

  it('limpar Números de WhatsApp mostra erro, desabilita Salvar e não chama a prévia', async () => {
    const user = userEvent.setup();
    montar();
    await user.clear(await screen.findByLabelText('Números de WhatsApp'));
    expect(screen.getByText('Digite um número inteiro (0 = ilimitado).')).toBeInTheDocument();
    expect(screen.getByLabelText('Números de WhatsApp')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Salvar pacote' })).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('só manda os limites que mudaram', async () => {
    api.post.mockResolvedValue({ data: { data: { clients_count: 2, changes: { features: [], limits: [] } } } });
    const user = userEvent.setup();
    montar();
    const campo = await screen.findByLabelText('Números de WhatsApp');
    await user.clear(campo); await user.type(campo, '3');
    await user.click(screen.getByRole('button', { name: 'Salvar pacote' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/super/packages/p1/preview_update', { name: 'Completo', limits: { max_whatsapp_channels: 3 } }));
  });

  it('nada mudou: não manda limits', async () => {
    api.post.mockResolvedValue({ data: { data: { clients_count: 2, changes: { features: [], limits: [] } } } });
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole('button', { name: 'Salvar pacote' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/super/packages/p1/preview_update', { name: 'Completo' }));
  });
});
