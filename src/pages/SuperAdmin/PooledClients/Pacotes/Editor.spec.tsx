import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));

const toastX = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastX }));

import Editor from './Editor';

const pacote = { id: 'p1', name: 'Completo', clients_count: 2, features_on: 1,
  limits: { max_whatsapp_channels: 5, ai_leads_included: null, ai_lead_overage_price_brl: 2.49 },
  features: { disparos: false }, catalog: [{ key: 'disparos', label: 'Disparos', group: 'disparos', theme: 'automacoes', theme_label: 'Automações' }],
  clients: [{ id: 'c1', name: 'A' }, { id: 'c2', name: 'B' }] };

const montar = () => render(<MemoryRouter initialEntries={['/admin/clientes/pacotes/p1']}>
  <Routes><Route path="/admin/clientes/pacotes/:id" element={<Editor />} /></Routes></MemoryRouter>);

describe('Editor de pacote', () => {
  beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); toastX.error.mockReset(); toastX.success.mockReset(); api.get.mockResolvedValue({ data: { data: pacote } }); });

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

  it('preço do plano vai junto ao salvar, só quando muda; texto torto trava', async () => {
    api.post.mockResolvedValue({ data: { data: { clients_count: 2, changes: { features: [], limits: [] } } } });
    const user = userEvent.setup();
    montar();
    const campo = await screen.findByLabelText('Preço do plano (R$/mês)');
    await user.type(campo, 'abc');
    expect(screen.getByRole('button', { name: 'Salvar pacote' })).toBeDisabled();
    await user.clear(campo);
    await user.type(campo, '1.500,00');
    await user.click(screen.getByRole('button', { name: 'Salvar pacote' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/super/packages/p1/preview_update', { name: 'Completo', price_brl: 1500 }));
  });

  it('prévia mostra a linha do preço (de/para) e, só com preço mudando, não engana sobre funções', async () => {
    api.get.mockResolvedValue({ data: { data: { ...pacote, price_brl: 1000 } } });
    api.post.mockResolvedValue({ data: { data: { clients_count: 2, changes: { features: [], limits: [] } } } });
    const user = userEvent.setup();
    montar();
    const campo = await screen.findByLabelText('Preço do plano (R$/mês)');
    await user.clear(campo); await user.type(campo, '1.500,00');
    await user.click(screen.getByRole('button', { name: 'Salvar pacote' }));
    expect(await screen.findByText(/Preço do plano: de R\$\s1\.000,00 para R\$\s1\.500,00 \(muda a receita dos clientes na cota do plano\)/)).toBeInTheDocument();
    expect(screen.getByText(/Funções e limites não mudam\./)).toBeInTheDocument();
    expect(screen.queryByText(/Ajustes manuais de cada cliente são mantidos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma função ou limite muda/)).not.toBeInTheDocument();
  });

  it('sem preço antes: a linha diz "sem preço"', async () => {
    api.post.mockResolvedValue({ data: { data: { clients_count: 2, changes: { features: [{ key: 'disparos', label: 'Disparos', from: false, to: true }], limits: [] } } } });
    const user = userEvent.setup();
    montar();
    await user.type(await screen.findByLabelText('Preço do plano (R$/mês)'), '900');
    await user.click(screen.getByRole('button', { name: 'Salvar pacote' }));
    expect(await screen.findByText(/Preço do plano: de \(sem preço\) para R\$\s900,00/)).toBeInTheDocument();
    expect(screen.getByText(/Ajustes manuais de cada cliente são mantidos/)).toBeInTheDocument();
  });

  it('PATCH leva price_brl novo; limpar manda null', async () => {
    api.get.mockResolvedValue({ data: { data: { ...pacote, price_brl: 1000 } } });
    api.post.mockResolvedValue({ data: { data: { clients_count: 2, changes: { features: [], limits: [] } } } });
    api.patch.mockResolvedValue({ data: { data: pacote, result: null } });
    const user = userEvent.setup();
    montar();
    const campo = await screen.findByLabelText('Preço do plano (R$/mês)');
    await user.clear(campo); await user.type(campo, '1500,5');
    await user.click(screen.getByRole('button', { name: 'Salvar pacote' }));
    await user.click(await screen.findByRole('button', { name: 'Só salvar o pacote' }));
    await waitFor(() => expect(api.patch).toHaveBeenLastCalledWith('/super/packages/p1', { name: 'Completo', price_brl: 1500.5, apply_to_clients: false }));
    await user.clear(campo);
    await user.click(screen.getByRole('button', { name: 'Salvar pacote' }));
    await user.click(await screen.findByRole('button', { name: 'Só salvar o pacote' }));
    await waitFor(() => expect(api.patch).toHaveBeenLastCalledWith('/super/packages/p1', { name: 'Completo', price_brl: null, apply_to_clients: false }));
  });

  it('422 do preço aparece como toast com a mensagem do servidor', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Preço do plano: deixe vazio ou informe um valor (0 ou mais).' } } });
    const user = userEvent.setup();
    montar();
    await user.type(await screen.findByLabelText('Preço do plano (R$/mês)'), '10');
    await user.click(screen.getByRole('button', { name: 'Salvar pacote' }));
    await waitFor(() => expect(toastX.error).toHaveBeenCalledWith('Preço do plano: deixe vazio ou informe um valor (0 ou mais).'));
  });
});
