import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Preparar from './Preparar';

const s = vi.hoisted(() => ({
  preflight: vi.fn(), saveConfig: vi.fn(), agents: vi.fn(), flows: vi.fn(),
}));
vi.mock('@/services/demoRoom/demoRoomService', () => ({
  demoRoomService: { preflight: s.preflight, saveConfig: s.saveConfig },
}));
vi.mock('@/services/salesAgents/salesAgentsService', () => ({
  salesAgentsService: { list: s.agents }, default: { list: s.agents },
}));
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { list: s.flows }, default: { list: s.flows },
}));

const state = {
  config: { agent_id: 'a1', agent_name: 'Ana', followup_flow_id: 'f1', property_code: 'AP1', wa_number: '5511900000000' },
  session: null, behind: null, followup: [],
};
const ok = [{ key: 'chip', ok: true, label: 'Chip conectado', fix: null }];

beforeEach(() => {
  for (const f of Object.values(s)) f.mockReset();
  s.preflight.mockResolvedValue(ok);
  s.agents.mockResolvedValue([{ id: 'a1', name: 'Ana' }, { id: 'a2', name: 'Beto' }]);
  s.flows.mockResolvedValue([{ id: 'f1', name: 'Follow da Sala' }]);
});

describe('Preparar', () => {
  it('confere ao abrir e mostra tudo certo', async () => {
    render(<Preparar state={state} onStart={vi.fn()} />);
    expect(await screen.findByText('Tudo certo para a demonstração.')).toBeInTheDocument();
    expect(s.preflight).toHaveBeenCalledWith(false);
  });

  it('Nova demonstração fica desabilitado com nome vazio e chama start com o nome', async () => {
    const onStart = vi.fn();
    render(<Preparar state={state} onStart={onStart} />);
    await screen.findByText('Tudo certo para a demonstração.');
    const botao = screen.getByRole('button', { name: 'Nova demonstração' });
    expect(botao).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Primeiro nome do lead'), 'Carlos');
    expect(botao).toBeEnabled();
    await userEvent.click(botao);
    expect(onStart).toHaveBeenCalledWith('Carlos');
  });

  it('item vermelho mostra label e fix e desabilita o botão', async () => {
    s.preflight.mockResolvedValue([
      ...ok,
      { key: 'book', ok: false, label: 'Book do imóvel', fix: 'Suba o book no imóvel AP1.' },
    ]);
    render(<Preparar state={state} onStart={vi.fn()} />);
    expect(await screen.findByText('Book do imóvel')).toBeInTheDocument();
    expect(screen.getByText('Suba o book no imóvel AP1.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Primeiro nome do lead'), 'Carlos');
    expect(screen.getByRole('button', { name: 'Nova demonstração' })).toBeDisabled();
  });

  it('Testar a voz chama preflight(true) e Conferir de novo chama preflight(false)', async () => {
    render(<Preparar state={state} onStart={vi.fn()} />);
    await screen.findByText('Tudo certo para a demonstração.');
    await userEvent.click(screen.getByRole('button', { name: 'Testar a voz' }));
    await waitFor(() => expect(s.preflight).toHaveBeenLastCalledWith(true));
    await userEvent.click(screen.getByRole('button', { name: 'Conferir de novo' }));
    await waitFor(() => expect(s.preflight).toHaveBeenLastCalledWith(false));
  });

  it('Ajustes da Sala salva a configuração e confere de novo', async () => {
    s.saveConfig.mockResolvedValue(undefined);
    render(<Preparar state={state} onStart={vi.fn()} />);
    await screen.findByText('Tudo certo para a demonstração.');
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes da Sala' }));
    const codigo = await screen.findByLabelText('Código do imóvel');
    await userEvent.clear(codigo);
    await userEvent.type(codigo, 'AP9');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar ajustes' }));
    await waitFor(() => expect(s.saveConfig).toHaveBeenCalledWith({
      agent_id: 'a1', followup_flow_id: 'f1', property_code: 'AP9',
    }));
    await waitFor(() => expect(s.preflight).toHaveBeenCalledTimes(2));
  });
});
