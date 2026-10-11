import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const s = vi.hoisted(() => ({ weeklyReport: vi.fn(), weeklyReportTargets: vi.fn() }));
vi.mock('@/services/salesAgents/salesAgentsService', () => ({
  salesAgentsService: {
    weeklyReport: s.weeklyReport,
    weeklyReportTargets: s.weeklyReportTargets,
    saveWeeklyReportConfig: vi.fn(),
    weeklyReportPreview: vi.fn(),
    weeklyReportSaveText: vi.fn(),
    weeklyReportSendNow: vi.fn(),
    weeklyReportDiagnostico: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import TelaRelatorioSemanal from './TelaRelatorioSemanal';

const PAYLOAD = {
  config: { enabled: true, weekday: 1, hour: 9, group_jids: [], user_ids: [] },
  current: null,
  history: [],
};

beforeEach(() => {
  s.weeklyReport.mockReset();
  s.weeklyReportTargets.mockReset();
});

describe('IA Vendedora → Relatórios · erro de carga', () => {
  it('leitura que falha não afirma "Nenhum grupo"/"Nenhum gestor" nem mostra o automático desmarcado', async () => {
    s.weeklyReport.mockRejectedValueOnce(new Error('500'));
    s.weeklyReportTargets.mockResolvedValueOnce({ groups: [], managers: [] });
    render(<TelaRelatorioSemanal />);
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    expect(screen.queryByText(/Nenhum grupo desta imobiliária/)).toBeNull();
    expect(screen.queryByText(/Nenhum gestor com WhatsApp/)).toBeNull();
    expect(screen.queryByText('Enviar toda semana, sozinho')).toBeNull();
    expect(screen.queryByRole('button', { name: /Enviar agora/ })).toBeNull();
  });

  it('Tentar de novo com sucesso traz os destinos e o automático como estão no servidor', async () => {
    s.weeklyReport.mockRejectedValueOnce(new Error('500'));
    s.weeklyReportTargets.mockResolvedValue({ groups: [], managers: [] });
    render(<TelaRelatorioSemanal />);
    const botao = await screen.findByRole('button', { name: 'Tentar de novo' });
    s.weeklyReport.mockResolvedValueOnce(PAYLOAD);
    await userEvent.click(botao);
    expect(await screen.findByLabelText('Enviar toda semana, sozinho')).toBeChecked();
    expect(screen.getByText(/Nenhum grupo desta imobiliária/)).toBeInTheDocument();
  });
});
