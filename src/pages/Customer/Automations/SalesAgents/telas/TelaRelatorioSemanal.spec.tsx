import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

const CAMPANHAS = [
  { key: 'form:1', label: 'Residencial Teste', kind: 'form', leads: 10, responderam: 6, passados: 3, visitas: 2, fora_do_perfil: 1,
    pararam: { chegou: 4, respondeu: 3, passou: 1, visita: 2 } },
  { key: 'ad:9', label: 'Anúncio AB01', kind: 'ad', leads: 4, responderam: 1, passados: 0, visitas: 0, fora_do_perfil: 0,
    pararam: { chegou: 3, respondeu: 1, passou: 0, visita: 0 } },
  { key: 'none', label: 'Sem campanha', kind: 'none', leads: 2, responderam: 0, passados: 0, visitas: 0, fora_do_perfil: 0,
    pararam: { chegou: 2, respondeu: 0, passou: 0, visita: 0 } },
];

const comRelatorio = (campanhas?: unknown) => ({
  ...PAYLOAD,
  current: {
    id: 'r1', period_start: '2026-10-19', period_end: '2026-10-25', period_label: '19/10 a 25/10', status: 'draft',
    automatic: false, text: 'Oi', stats: { ia: { attended: 16 }, equipe: {}, ...(campanhas ? { campanhas } : {}) },
    destinations: [], results: [], delivered_count: 0, failed_count: 0, cost_usd: 0, sent_at: null, created_at: '2026-10-26',
  },
});

describe('IA Vendedora → Relatórios · por campanha', () => {
  it('com duas campanhas, a tabela separa as duas e a conversa sem marca cai em "Sem campanha"', async () => {
    s.weeklyReport.mockResolvedValue(comRelatorio(CAMPANHAS));
    s.weeklyReportTargets.mockResolvedValue({ groups: [], managers: [] });
    render(<TelaRelatorioSemanal />);
    const tabela = await screen.findByRole('table', { name: 'Por campanha' });
    for (const cab of ['Campanha', 'Leads', 'Responderam', 'Passados', 'Visitas', 'Fora do perfil', 'Onde pararam']) {
      expect(within(tabela).getByRole('columnheader', { name: cab })).toBeInTheDocument();
    }
    const linhas = within(tabela).getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(3);
    expect(within(linhas[0]).getByText('Residencial Teste')).toBeInTheDocument();
    expect(within(linhas[0]).getAllByRole('cell')[1]).toHaveTextContent('10');
    expect(within(linhas[1]).getByText('Anúncio AB01')).toBeInTheDocument();
    expect(within(linhas[1]).getAllByRole('cell')[1]).toHaveTextContent('4');
    expect(within(linhas[2]).getByText('Sem campanha')).toBeInTheDocument();
    expect(within(linhas[0]).getByText(/Visita 2/)).toBeInTheDocument();
  });

  it('sem o campo no relatório (servidor antigo), sem tabela', async () => {
    s.weeklyReport.mockResolvedValue(comRelatorio());
    s.weeklyReportTargets.mockResolvedValue({ groups: [], managers: [] });
    render(<TelaRelatorioSemanal />);
    expect(await screen.findByText('Leads atendidos')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Por campanha' })).toBeNull();
  });

  it('lista vazia, sem tabela', async () => {
    s.weeklyReport.mockResolvedValue(comRelatorio([]));
    s.weeklyReportTargets.mockResolvedValue({ groups: [], managers: [] });
    render(<TelaRelatorioSemanal />);
    expect(await screen.findByText('Leads atendidos')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Por campanha' })).toBeNull();
  });
});
