// src/pages/SuperAdmin/PooledClients/Cliente/AbaContrato.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const api = vi.hoisted(() => ({ patch: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));

import AbaContrato from './AbaContrato';

const cliente = { id: 'c1', name: '016', slug: 'x', schema_name: 'tenant_x', status: 'active', members: 2, login_url: '',
  max_whatsapp_channels: 5, ai_leads_included: null, ai_lead_overage_price_brl: 2.49,
  settings: { whatsapp_reminder_group_jid: '123@g.us', whatsapp_logs_group_jid: '' } };

describe('Aba Contrato (limites)', () => {
  beforeEach(() => api.patch.mockReset());

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
