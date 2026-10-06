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
  update.mockImplementation(async (_id: string, patch: Partial<SalesAgent>) => agenteDeTeste(patch));
});

const salvar = () => userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

vi.mock('@/services/roletaConfig/roletaConfigService', () => ({
  roletaConfigService: { getAll: vi.fn().mockResolvedValue([{ id: 'r1', name: 'Fila Zona Sul', is_active: true }]) },
}));
vi.mock('@/services/channels/agentsService', () => ({ default: { getAll: vi.fn().mockResolvedValue([{ id: 'u1', name: 'Carla' }]) } }));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: { getPipelines: vi.fn().mockResolvedValue({ data: [] }), getPipelineStages: vi.fn().mockResolvedValue({ data: [] }) },
}));

import Passo2Objetivo from './Passo2Objetivo';

const abrir = (agent: SalesAgent = agenteDeTeste()) =>
  render(<MemoryRouter><Passo2Objetivo agent={agent} inboxes={[]} aoSalvo={vi.fn()} irParaPasso={vi.fn()} /></MemoryRouter>);

const dono = (extra: Partial<SalesAgent> = {}) => agenteDeTeste({
  persona_kind: 'owner', handoff_target: 'inbox_roleta', handoff_user_id: null,
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

  it('temperatura preserva as obrigatórias e o resumo desligado', async () => {
    abrir(dono());
    await userEvent.click(screen.getByLabelText('Quando o lead estiver quente'));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', {
      transfer_config: { mode: 'temperatura', min_temperature: 'hot', required_questions: ['Renda'], briefing_enabled: false },
    });
  });

  it('roleta escolhida', async () => {
    abrir(dono());
    await userEvent.click(screen.getByLabelText('Uma roleta escolhida'));
    await waitFor(() => expect(screen.getByRole('option', { name: 'Fila Zona Sul' })).toBeTruthy());
    await userEvent.selectOptions(screen.getByLabelText('Qual roleta'), 'r1');
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { handoff_target: 'roleta', handoff_roleta_config_id: 'r1' });
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

  it('a prévia diz o que acontece', () => {
    abrir(dono());
    expect(screen.getByText('Ela qualifica, marca a visita e entrega pra roleta do número.')).toBeTruthy();
  });
});
