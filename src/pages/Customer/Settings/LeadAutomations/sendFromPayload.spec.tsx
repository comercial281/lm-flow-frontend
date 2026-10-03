import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// E24: regra de hoje (ação de mensagem sem `send_from` gravado) tem de salvar
// EXATAMENTE como hoje. `applySendFrom` só roda dentro do onChange do campo
// (LeadAutomationsEditors.tsx); renderizar o editor de uma regra existente,
// sem tocar em "Enviar pelo número", não pode por si só alterar os params da
// ação — senão editar e salvar uma regra de hoje já mudaria o payload.
const sendNumbers = vi.hoisted(() => vi.fn());
vi.mock('@/services/numbers/numbersService', () => ({ default: { sendNumbers } }));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => false }));

import { ActionEditor, type AutomationResources } from './LeadAutomationsEditors';
import type { LeadAutomationAction } from '@/services/leadAutomation/leadAutomationService';

const resources: AutomationResources = {
  labels: [],
  sequences: [],
  followupFlows: [],
  users: [],
  pipelines: [],
  stagesByPipeline: {},
  quickReplies: [],
  adOrigins: [],
  formOrigins: [],
  messageFunnels: [],
  evolutionInstances: [],
  reloadFunnels: () => {},
  reloadLabels: () => {},
  loading: false,
};

beforeEach(() => {
  sendNumbers.mockReset();
});

describe('E24 — regra de hoje não muda ao só abrir o editor', () => {
  it('ação "Enviar mensagem WhatsApp" sem send_from: abrir o editor não chama onChange', async () => {
    sendNumbers.mockResolvedValue({
      number_owner_rule: false,
      numbers: [{ inbox_id: 'i1', name: 'Loja', phone: null, connection: 'connected', owner: null }],
    });
    const onChange = vi.fn();
    // Params como uma regra criada ANTES da fase 2b.2: só `message`, sem
    // `send_from`/`send_from_inbox_id`.
    const action: LeadAutomationAction = { type: 'send_whatsapp_message', params: { message: 'Olá {{nome}}' } };

    render(<ActionEditor action={action} onChange={onChange} resources={resources} />);

    // Espera o campo "Enviar pelo número" terminar de carregar a lista.
    expect(await screen.findByRole('option', { name: 'Loja' })).toBeInTheDocument();

    expect(onChange).not.toHaveBeenCalled();
  });
});
