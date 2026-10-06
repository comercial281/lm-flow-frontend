import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';

const update = vi.fn();
vi.mock('@/services/salesAgents/salesAgentsService', async (orig) => {
  const real = await orig<typeof import('@/services/salesAgents/salesAgentsService')>();
  return { ...real, salesAgentsService: { ...real.salesAgentsService, update: (...a: unknown[]) => update(...a) } };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  roletaDoNumero.mockResolvedValue(null);
  update.mockImplementation(async (_id: string, patch: Partial<SalesAgent>) => agenteDeTeste(patch));
});

const salvar = () => userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

const roletaDoNumero = vi.hoisted(() => vi.fn());
vi.mock('@/services/roletaConfig/roletaConfigService', () => ({
  roletaConfigService: {
    getAll: vi.fn().mockResolvedValue([{ id: 'r1', name: 'Fila Zona Sul', is_active: true }]),
    getForInbox: roletaDoNumero,
  },
}));
vi.mock('@/services/channels/agentsService', () => ({ default: { getAll: vi.fn().mockResolvedValue([{ id: 'u1', name: 'Carla' }]) } }));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: { getPipelines: vi.fn().mockResolvedValue({ data: [] }), getPipelineStages: vi.fn().mockResolvedValue({ data: [] }) },
}));

import { toast } from 'sonner';
import Passo2Objetivo from './Passo2Objetivo';

const abrir = (agent: SalesAgent = agenteDeTeste()) =>
  render(<MemoryRouter><Passo2Objetivo agent={agent} inboxes={[]} aoSalvo={vi.fn()} irParaPasso={vi.fn()} /></MemoryRouter>);

const dono = (extra: Partial<SalesAgent> = {}) => agenteDeTeste({
  persona_kind: 'owner', handoff_target: 'roleta', handoff_roleta_config_id: null, handoff_user_id: null,
  transfer_config: { mode: 'checklist', required_questions: ['Renda'], briefing_enabled: false }, ...extra,
});

describe('Passo 2 · Objetivo', () => {
  // Mudar o alcance NÃO pode mexer no destino (no corretor antigo, isso trocaria
  // o fixo pelo dono do número sem ninguém pedir).
  it('só qualifica e passa: manda o alcance e o espelho, e mais nada', async () => {
    abrir();
    await userEvent.click(screen.getByLabelText('Só qualifica e passa'));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { reach: 'qualify', booking_enabled: false });
  });

  it('corretor antigo com fixo: sem escolha de destino, e o clique explícito passa pro dono do número', async () => {
    abrir();
    expect(screen.queryByLabelText('A roleta deste número')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Passar a entregar pro dono do número' }));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { handoff_target: 'number_owner', handoff_user_id: null });
  });

  // IA antiga: persona só derivada da voz (coluna vazia). A conversão grava a coluna,
  // e aí o servidor passa a valer a trava do número sem dono.
  it('converter uma IA antiga grava a persona junto', async () => {
    abrir(agenteDeTeste({ persona_kind: null }));
    await userEvent.click(screen.getByRole('button', { name: 'Passar a entregar pro dono do número' }));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { persona_kind: 'broker', handoff_target: 'number_owner', handoff_user_id: null });
  });

  it('corretor antigo com fixo num número sem dono: não converte, avisa', () => {
    abrir(agenteDeTeste({ number_owner_id: null }));
    expect(screen.queryByRole('button', { name: 'Passar a entregar pro dono do número' })).toBeNull();
    expect(screen.getByText(/não tem corretor dono/)).toBeTruthy();
  });

  it('temperatura preserva as obrigatórias e o resumo desligado', async () => {
    abrir(dono());
    await userEvent.click(screen.getByLabelText('Quando o lead estiver quente'));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', {
      transfer_config: { mode: 'temperatura', min_temperature: 'hot', required_questions: ['Renda'], briefing_enabled: false },
    });
  });

  it('roleta escolhida', async () => {
    abrir(dono({ handoff_target: 'user', handoff_user_id: 'u1' }));
    await userEvent.click(screen.getByLabelText('Uma roleta'));
    await waitFor(() => expect(screen.getByRole('option', { name: 'Fila Zona Sul' })).toBeTruthy());
    await userEvent.selectOptions(screen.getByLabelText('Qual roleta'), 'r1');
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { handoff_target: 'roleta', handoff_roleta_config_id: 'r1', handoff_user_id: null });
  });

  it('depois da visita fica travado quando ela só qualifica', () => {
    abrir(dono({ reach: 'qualify' }));
    expect(screen.getByLabelText('Depois da visita')).toBeDisabled();
  });

  it('opção antiga continua marcada e com nome', () => {
    abrir(dono({ transfer_config: { mode: 'sem_resposta' } }));
    expect(screen.getByLabelText('Só quando ela não souber responder (opção antiga)')).toBeChecked();
  });

  it('lead frio pro CRM preserva o resto da política', async () => {
    abrir(dono());
    await userEvent.click(screen.getByLabelText('Mandar lead frio pro CRM'));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { crm_policy: { cold: true, capture: false, invalid: true } });
  });

  it('a prévia diz o que acontece', async () => {
    abrir(dono({ handoff_roleta_config_id: 'r1' }));
    expect(await screen.findByText('Ela qualifica, marca a visita e entrega pra roleta Fila Zona Sul.')).toBeTruthy();
  });
});

// Entrega 5: o lead vai pro sistema que a imobiliária já usa.
describe('Passo 2 · Sistema do cliente', () => {
  it('escolher, dar o endereço e salvar manda só o destino e o endereço', async () => {
    abrir(dono());
    await userEvent.click(screen.getByLabelText('Sistema do cliente'));
    await userEvent.type(screen.getByLabelText(/endereço/i), 'https://crm.exemplo.com.br/leads');
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { handoff_target: 'webhook', handoff_webhook_url: 'https://crm.exemplo.com.br/leads' });
  });

  it('endereço ruim não sai do passo', async () => {
    abrir(dono());
    await userEvent.click(screen.getByLabelText('Sistema do cliente'));
    await userEvent.type(screen.getByLabelText(/endereço/i), 'http://localhost/x');
    await salvar();
    expect(update).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('a prévia diz que o lead vai pro sistema do cliente', () => {
    abrir(dono({ handoff_target: 'webhook', handoff_webhook_url: 'https://crm.exemplo.com.br/leads' }));
    expect(screen.getByText('Ela qualifica, marca a visita e entrega pro sistema do cliente.')).toBeTruthy();
  });
});


// Roleta nova (06/10/2026): a roleta não tem número. "A roleta deste número" saiu
// e a IA que ainda tem esse valor gravado vem com "Uma roleta" escolhida e o
// pedido de confirmação.
describe('Passo 2 · Pra onde vai o lead (roleta nova)', () => {
  it('IA em "Uma roleta" não consulta a roleta do número', () => {
    abrir(dono());
    expect(screen.getByLabelText('Uma roleta')).toBeChecked();
    expect(screen.queryByLabelText('A roleta deste número')).toBeNull();
    expect(roletaDoNumero).not.toHaveBeenCalled();
  });

  it('valor antigo: "A roleta deste número" não aparece e a roleta do número vem escolhida pra confirmar', async () => {
    roletaDoNumero.mockResolvedValue({ id: 'r1', name: 'Fila Zona Sul', is_active: true });
    abrir(dono({ handoff_target: 'inbox_roleta' }));
    await waitFor(() => expect(screen.getByLabelText('Uma roleta')).toBeChecked());
    expect(screen.queryByLabelText('A roleta deste número')).toBeNull();
    expect(roletaDoNumero).toHaveBeenCalledWith('inbox-1');
    expect(screen.getByText('Confirme a roleta')).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('Qual roleta')).toHaveValue('r1'));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { handoff_target: 'roleta', handoff_roleta_config_id: 'r1' });
  });

  it('valor antigo sem roleta no número: "Uma roleta" em branco, pedindo a escolha', async () => {
    abrir(dono({ handoff_target: 'inbox_roleta' }));
    await waitFor(() => expect(screen.getByLabelText('Uma roleta')).toBeChecked());
    expect(screen.getByText(/Escolha a roleta e salve/)).toBeTruthy();
    expect(screen.getByLabelText('Qual roleta')).toHaveValue('');
  });
});
