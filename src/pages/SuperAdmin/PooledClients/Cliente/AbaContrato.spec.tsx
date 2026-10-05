// src/pages/SuperAdmin/PooledClients/Cliente/AbaContrato.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const apiX = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: apiX }));
const api = apiX;

import AbaContrato from './AbaContrato';

const cliente = { id: 'c1', name: '016', slug: 'x', schema_name: 'tenant_x', status: 'active', members: 2, login_url: '',
  max_whatsapp_channels: 5, ai_leads_included: null, ai_lead_overage_price_brl: 2.49,
  settings: { whatsapp_reminder_group_jid: '123@g.us', whatsapp_logs_group_jid: '' } };

const clienteComPacote = { ...cliente, package: { id: 'p1', name: 'Completo' }, package_diff_count: 2,
  package_diff: { features: [{ key: 'bolsao', label: 'Bolsão', tenant: false, package: true }], limits: [{ key: 'max_whatsapp_channels', tenant: 3, package: 5 }] } };

describe('Aba Contrato (limites)', () => {
  beforeEach(() => { apiX.get.mockReset(); apiX.post.mockReset(); apiX.patch.mockReset(); });

  it('trocar pacote mostra o que muda e avisa os ajustes desfeitos', async () => {
    apiX.get.mockResolvedValue({ data: { data: [{ id: 'p2', name: 'Essencial', clients_count: 0, features_on: 3, limits: {} }] } });
    apiX.post.mockImplementation((_url: string, body: { dry_run?: boolean }) => Promise.resolve({ data: body.dry_run
      ? { data: { changes: { features: [{ key: 'disparos', label: 'Disparos', tenant: true, package: false }], limits: [{ key: 'max_whatsapp_channels', tenant: 5, package: 2 }] }, undone: 2 } }
      : { data: { ...clienteComPacote, package: { id: 'p2', name: 'Essencial' } }, undone: 2 } }));
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    render(<AbaContrato cliente={clienteComPacote as any} aoMudar={aoMudar} recarregar={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Trocar pacote' }));
    await user.selectOptions(await screen.findByLabelText('Novo pacote'), 'p2');
    expect(await screen.findByText('desliga Disparos')).toBeInTheDocument();
    expect(screen.getByText('números de WhatsApp 5 → 2')).toBeInTheDocument();
    expect(screen.getByText('Os 2 ajustes manuais deste cliente serão desfeitos.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Trocar' }));
    await waitFor(() => expect(apiX.post).toHaveBeenLastCalledWith('/super/pooled_tenants/c1/assign_package', { package_id: 'p2', dry_run: false }));
    await waitFor(() => expect(aoMudar).toHaveBeenCalled());
  });

  it('Voltar ao pacote mostra a prévia e só aplica ao confirmar', async () => {
    apiX.post.mockImplementation((_url: string, body: { dry_run?: boolean }) => Promise.resolve({ data: body.dry_run
      ? { data: { changes: { features: [{ key: 'bolsao', label: 'Bolsão', tenant: false, package: true }], limits: [] }, undone: 1 } }
      : { data: { ...clienteComPacote, package_diff_count: 0 }, undone: 1 } }));
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    render(<AbaContrato cliente={clienteComPacote as any} aoMudar={aoMudar} recarregar={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Voltar ao pacote' }));
    expect(await screen.findByText('liga Bolsão')).toBeInTheDocument();
    expect(screen.getByText('Os 1 ajustes manuais deste cliente serão desfeitos.')).toBeInTheDocument();
    expect(apiX.post).toHaveBeenCalledTimes(1);
    await user.click(screen.getAllByRole('button', { name: 'Voltar ao pacote' }).at(-1)!);
    await waitFor(() => expect(apiX.post).toHaveBeenLastCalledWith('/super/pooled_tenants/c1/reset_to_package', { dry_run: false }));
    await waitFor(() => expect(aoMudar).toHaveBeenCalled());
  });

  it('cliente Personalizado não tem Voltar ao pacote', () => {
    render(<AbaContrato cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    expect(screen.getByText('Personalizado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voltar ao pacote' })).not.toBeInTheDocument();
  });

  it('limite diferente do pacote aparece ≠ pacote', () => {
    render(<AbaContrato cliente={clienteComPacote as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    expect(screen.getAllByText('≠ pacote').length).toBeGreaterThan(0);
  });


  it('salva os limites reenviando os grupos do estado', async () => {
    api.patch.mockResolvedValue({ data: { data: { ...cliente, max_whatsapp_channels: 2 } } });
    const aoMudar = vi.fn();
    render(<AbaContrato cliente={cliente as any} aoMudar={aoMudar} recarregar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Números de WhatsApp'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar limites' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/super/pooled_tenants/c1', expect.objectContaining({
      name: '016', max_whatsapp_channels: 2, ai_leads_included: null, ai_lead_overage_price_brl: 2.49,
      whatsapp_reminder_group_jid: '123@g.us', whatsapp_logs_group_jid: '',
    })));
    await waitFor(() => expect(aoMudar).toHaveBeenCalled());
  });

  it('campo de números vazio ou inválido desabilita Salvar e não chama o servidor', () => {
    render(<AbaContrato cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    const salvar = screen.getByRole('button', { name: 'Salvar limites' });
    fireEvent.change(screen.getByLabelText('Números de WhatsApp'), { target: { value: '' } });
    expect(salvar).toBeDisabled();
    expect(screen.getByText(/número inteiro/)).toBeInTheDocument();
    fireEvent.click(salvar);
    fireEvent.change(screen.getByLabelText('Números de WhatsApp'), { target: { value: 'abc' } });
    expect(salvar).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Números de WhatsApp'), { target: { value: '0' } });
    expect(salvar).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Preço do excedente (R$)'), { target: { value: '-1' } });
    expect(salvar).toBeDisabled();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('mostra os limites novos quando o cliente é atualizado por fora', () => {
    const { rerender } = render(<AbaContrato cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    rerender(<AbaContrato cliente={{ ...cliente, max_whatsapp_channels: 9, ai_leads_included: 100 } as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    expect(screen.getByLabelText('Números de WhatsApp')).toHaveValue('9');
    expect(screen.getByLabelText('Franquia de leads da IA')).toHaveValue('100');
  });
});
