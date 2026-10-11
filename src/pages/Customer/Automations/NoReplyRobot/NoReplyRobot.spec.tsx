import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NoReplyRobot from './NoReplyRobot';

const s = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock('@/services/noReplyRobot/noReplyRobotService', () => ({
  noReplyRobotService: { get: s.get, update: s.update },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const CONFIG = {
  enabled: true,
  minutes: 45,
  scan_window_hours: 12,
  audience: 'paid' as const,
  skip_unnamed: false,
  sequence_slug: 'padrao',
  sequences: [{ slug: 'padrao', name: 'Padrão 30 dias', steps_count: 4 }],
  audiences: [
    { value: 'pipeline' as const, label: 'Só quem tem card no funil' },
    { value: 'paid' as const, label: 'Só tráfego pago' },
  ],
  managed_rule_id: null,
  pending_jobs: 2,
  sent_24h: 5,
  legacy_active_rules: [],
};

beforeEach(() => {
  s.get.mockReset();
  s.update.mockReset();
});

describe('Quem não respondeu · erro de carga', () => {
  it('carga que falha mostra só o erro, sem formulário nem Salvar (Salvar gravaria os padrões por cima)', async () => {
    s.get.mockRejectedValueOnce(Object.assign(new Error('500'), { response: { status: 500 } }));
    render(<NoReplyRobot embedded />);
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Salvar/ })).toBeNull();
    expect(screen.queryByLabelText('Esperar sem resposta (minutos)')).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Ativar o robô' })).toBeNull();
  });

  it('Tentar de novo com sucesso mostra o formulário com os valores do servidor', async () => {
    s.get.mockRejectedValueOnce(new Error('rede'));
    render(<NoReplyRobot embedded />);
    const botao = await screen.findByRole('button', { name: 'Tentar de novo' });
    s.get.mockResolvedValueOnce(CONFIG);
    await userEvent.click(botao);
    expect(await screen.findByRole('button', { name: /Salvar/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Esperar sem resposta (minutos)')).toHaveValue(45);
    expect(screen.getByLabelText('Olhar conversas das últimas (horas)')).toHaveValue(12);
    expect(screen.getByRole('switch', { name: 'Ativar o robô' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
  });
});
