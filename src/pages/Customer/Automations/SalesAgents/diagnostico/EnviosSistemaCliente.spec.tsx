import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { WebhookDelivery } from '@/services/salesAgents/salesAgentsService';

// "A lista dos últimos envios com a resposta" (spec 05/10): é o que o gestor manda
// pra quem cuida do sistema do cliente quando o lead não aparece lá.
const servico = vi.hoisted(() => ({ webhookDeliveries: vi.fn() }));
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: servico }));

import EnviosSistemaCliente from './EnviosSistemaCliente';

const base: WebhookDelivery = {
  id: 'd1',
  created_at: '2026-10-05T17:32:00Z',
  mode: 'real',
  status: 'delivered',
  attempts: 1,
  max_attempts: 5,
  next_attempt_at: null,
  response_code: 200,
  response_excerpt: '{"ok":true}',
  last_error: null,
  duration_ms: 312,
  delivered_at: '2026-10-05T17:32:01Z',
  failed_at: null,
  contact_name: 'Mariana Souza',
  conversation_path: '/conversations/4821',
};

const montar = () =>
  render(
    <MemoryRouter>
      <EnviosSistemaCliente agentId="a1" />
    </MemoryRouter>,
  );

beforeEach(() => servico.webhookDeliveries.mockReset());

describe('EnviosSistemaCliente', () => {
  it('lista os envios com a situação de cada um, teste marcado', async () => {
    servico.webhookDeliveries.mockResolvedValue([
      base,
      { ...base, id: 'd2', mode: 'test', status: 'failed', attempts: 1, response_code: 401, contact_name: null },
    ]);

    montar();

    expect(await screen.findByText('Mariana Souza')).toBeInTheDocument();
    expect(screen.getByText('Entregue')).toBeInTheDocument();
    expect(screen.getByText('Lead de teste')).toBeInTheDocument();
    expect(screen.getByText('Não entregue (1 tentativa)')).toBeInTheDocument();
    expect(screen.getAllByText('05/10 14:32').length).toBe(2);
  });

  it('abrir um envio mostra a resposta e o link da conversa', async () => {
    servico.webhookDeliveries.mockResolvedValue([base]);
    const user = userEvent.setup();
    montar();

    await user.click(await screen.findByRole('button', { name: /Mariana Souza/ }));

    expect(screen.getByText(/O sistema do cliente recebeu \(código 200\) em 0,3 s/)).toBeInTheDocument();
    expect(screen.getByText('{"ok":true}')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir a conversa' })).toHaveAttribute('href', '/conversations/4821');
  });

  it('sem envio ainda, diz como testar', async () => {
    servico.webhookDeliveries.mockResolvedValue([]);

    montar();

    expect(await screen.findByText(/Nenhum envio ainda/)).toBeInTheDocument();
  });
});
