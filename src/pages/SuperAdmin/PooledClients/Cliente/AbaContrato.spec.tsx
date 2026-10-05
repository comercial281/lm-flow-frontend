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
});
