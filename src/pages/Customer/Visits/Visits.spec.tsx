import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/contexts/TenantFeaturesContext', async (orig) => {
  const real = await orig<typeof import('@/contexts/TenantFeaturesContext')>();
  return { ...real, useFeature: () => true };
});

const list = vi.fn();
const cancel = vi.fn();
vi.mock('@/services/visits/visitsService', async (orig) => {
  const real = await orig<typeof import('@/services/visits/visitsService')>();
  return {
    ...real,
    visitsService: {
      ...real.visitsService,
      list: (...a: unknown[]) => list(...a),
      cancel: (...a: unknown[]) => cancel(...a),
      realtors: vi.fn().mockResolvedValue([]),
      leadPickerPage: vi.fn().mockResolvedValue({ data: [], meta: {} }),
    },
  };
});

vi.mock('@/hooks/useCan', () => ({ useCan: () => () => true }));

// A janela de agendar de verdade busca horários e corretores: aqui só importa
// com qual dia ela abriu.
vi.mock('@/components/visits/ScheduleVisitDialog', () => ({
  ScheduleVisitDialog: (p: { open: boolean; diaInicial?: Date | null }) =>
    p.open ? <div data-testid="janela" data-dia={p.diaInicial ? p.diaInicial.toDateString() : ''}>Janela de agendar</div> : null,
}));

const getSettings = vi.fn();
const listTimeOffs = vi.fn();
vi.mock('@/services/visits/agendaService', () => ({
  agendaService: {
    getSettings: (...a: unknown[]) => getSettings(...a),
    listTimeOffs: (...a: unknown[]) => listTimeOffs(...a),
  },
}));

import Visits from './Visits';
import { esquecerAgendaLigada } from '@/features/visits/useAgendaLigada';
import { simularCelular } from '@/test/telaDeCelular';

// A agenda ligada ou não é o que o servidor responde em `GET /visit_settings`.
const LIGADA = { enabled: true, days: [1, 2, 3, 4, 5, 6], start: '08:00', end: '20:00', closed_dates: [], seeded_from: {} };

const abrir = () => render(<MemoryRouter><Visits /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  esquecerAgendaLigada();
  list.mockResolvedValue({ data: [], meta: { total: 0, only_mine: false } });
  getSettings.mockResolvedValue(LIGADA);
  listTimeOffs.mockResolvedValue([]);
});

describe('Agenda de Visitas: botões da agenda do corretor', () => {
  it('servidor com a agenda desligada (`enabled: false`): nenhum botão novo', async () => {
    getSettings.mockResolvedValue({ enabled: false });
    abrir();
    expect(await screen.findByRole('button', { name: /Agendar visita/ })).toBeInTheDocument();
    expect(list).toHaveBeenCalled();
    await waitFor(() => expect(getSettings).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByRole('button', { name: /Horário de visita/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Folgas/ })).toBeNull();
    expect(listTimeOffs).not.toHaveBeenCalled();
  });

  it('403 ou erro no horário de visita: nenhum botão novo', async () => {
    getSettings.mockRejectedValue(new Error('403'));
    abrir();
    expect(await screen.findByRole('button', { name: /Agendar visita/ })).toBeInTheDocument();
    await waitFor(() => expect(getSettings).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByRole('button', { name: /Horário de visita/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Folgas/ })).toBeNull();
  });

  it('agenda ligada no servidor, gestor: Horário de visita e Folgas', async () => {
    const user = userEvent.setup();
    abrir();
    const horario = await screen.findByRole('button', { name: /Horário de visita/ });
    expect(screen.getByRole('button', { name: /^Folgas$/ })).toBeInTheDocument();
    await user.click(horario);
    expect(await screen.findByRole('heading', { name: 'Horário de visita' })).toBeInTheDocument();
  });

  it('agenda ligada no servidor, corretor: só Minhas folgas, sem Horário de visita', async () => {
    list.mockResolvedValue({ data: [], meta: { total: 0, only_mine: true } });
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('button', { name: /Minhas folgas/ }));
    expect(await screen.findByRole('heading', { name: 'Minhas folgas' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Horário de visita/ })).toBeNull();
  });
});

describe('Agenda de Visitas: Semana e Dia', () => {
  beforeEach(() => {
    try { localStorage.removeItem('lm-visitas-visao'); } catch { /* sem armazenamento */ }
  });

  it('Semana pede ao servidor só a semana e desenha a visita como bloco', async () => {
    const hoje = new Date();
    const as15 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 15, 0);
    list.mockResolvedValue({
      data: [{ id: 'v1', status: 'scheduled', scheduled_at: as15.toISOString(), duration_minutes: 60, contact: { id: 'c1', name: 'Thyago' } }],
      meta: { total: 1, active_total: 1, only_mine: false },
    });
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('radio', { name: 'Semana' }));

    const domingo = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - hoje.getDay());
    const sabado = new Date(domingo.getFullYear(), domingo.getMonth(), domingo.getDate() + 6);
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ since: iso(domingo), until: iso(sabado) })));
    expect(await screen.findByRole('button', { name: /15:00–16:00 · Thyago/ })).toBeInTheDocument();
    expect(screen.getByText(/1 visita nesta semana/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Semana' })).toHaveAttribute('aria-checked', 'true');
  });

  it('clicar no dia da semana abre a visão Dia, e a escolha fica guardada', async () => {
    list.mockResolvedValue({ data: [], meta: { total: 0, active_total: 0, only_mine: false } });
    const user = userEvent.setup();
    const { unmount } = abrir();
    await user.click(await screen.findByRole('radio', { name: 'Semana' }));
    const hoje = new Date();
    await user.click(screen.getByRole('button', { name: `Ver o dia ${hoje.getDate()}` }));
    expect(screen.getByRole('radio', { name: 'Dia' })).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(screen.getByText(/0 visitas hoje/)).toBeInTheDocument());
    unmount();

    abrir();
    expect(await screen.findByRole('radio', { name: 'Dia' })).toHaveAttribute('aria-checked', 'true');
  });
});

// Relógio parado às 11h: as visitas de 15h do teste ainda não aconteceram,
// senão o resultado dependeria da hora em que a suíte roda.
const pararRelogio = () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 10, 11, 0));
};

describe('Agenda de Visitas: clique na visita do calendário', () => {
  afterEach(() => { vi.useRealTimers(); });
  beforeEach(() => {
    pararRelogio();
    try { localStorage.removeItem('lm-visitas-visao'); } catch { /* sem armazenamento */ }
  });

  it('visita agendada abre o resumo com Confirmar / Remarcar / Cancelar, e dá para cancelar', async () => {
    const hoje = new Date();
    const as15 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 15, 0);
    const visita = { id: 'v1', status: 'scheduled', scheduled_at: as15.toISOString(), duration_minutes: 60, contact: { id: 'c1', name: 'Thyago' } };
    list.mockResolvedValue({ data: [visita], meta: { total: 1, active_total: 1, only_mine: false } });
    cancel.mockResolvedValue({ ...visita, status: 'cancelled' });
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('radio', { name: 'Semana' }));
    await user.click(await screen.findByRole('button', { name: /15:00–16:00 · Thyago/ }));

    const resumo = await screen.findByRole('dialog');
    expect(within(resumo).getByRole('button', { name: /Confirmar/ })).toBeInTheDocument();
    expect(within(resumo).getByRole('button', { name: /^Remarcar$/ })).toBeInTheDocument();
    await user.click(within(resumo).getByRole('button', { name: /Cancelar/ }));

    // O diálogo é da peça única e vive dentro do resumo: o resumo continua aberto.
    expect(await screen.findByText('Motivo do cancelamento')).toBeInTheDocument();
    expect(screen.getAllByRole('dialog', { hidden: true }).length).toBeGreaterThan(1);
    expect(resumo).toBeInTheDocument();
    expect(within(resumo).getByRole('button', { name: /^Remarcar$/, hidden: true })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar visita' }));
    expect(cancel).toHaveBeenCalledWith('v1', undefined);
  });

  it('visita Reagendada clicada no calendário abre o resumo', async () => {
    const hoje = new Date();
    const as15 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 15, 0);
    const visita = { id: 'v2', status: 'rescheduled', scheduled_at: as15.toISOString(), duration_minutes: 60, contact: { id: 'c1', name: 'Thyago' } };
    list.mockResolvedValue({ data: [visita], meta: { total: 1, active_total: 1, only_mine: false } });
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('radio', { name: 'Semana' }));
    await user.click(await screen.findByRole('button', { name: /15:00–16:00 · Thyago/ }));
    const resumo = await screen.findByRole('dialog');
    expect(within(resumo).getByRole('button', { name: /Cancelar/ })).toBeInTheDocument();
  });
});

describe('Agenda de Visitas: dia que já passou', () => {
  afterEach(() => { vi.useRealTimers(); });
  beforeEach(() => {
    pararRelogio();
    try { localStorage.removeItem('lm-visitas-visao'); } catch { /* sem armazenamento */ }
  });

  const ontem = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 15, 0);
  };
  const visitaDeOntem = () => ({ id: 'v3', status: 'scheduled', scheduled_at: ontem().toISOString(), duration_minutes: 60, contact: { id: 'c1', name: 'Thyago' } });

  it('clicar num dia passado no Mês abre a janela com esse dia', async () => {
    list.mockResolvedValue({ data: [visitaDeOntem()], meta: { total: 1, active_total: 1, only_mine: false } });
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('radio', { name: 'Mês' }));
    const celula = (await screen.findByRole('button', { name: /15:00 · Thyago/ })).parentElement!;
    fireEvent.click(celula);
    const janela = await screen.findByTestId('janela');
    expect(janela).toHaveAttribute('data-dia', ontem().toDateString());
  });

  it('a Lista mostra Não compareceu / Remarcar / Realizada na visita de ontem', async () => {
    list.mockResolvedValue({ data: [visitaDeOntem()], meta: { total: 1, active_total: 1, only_mine: false } });
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('button', { name: 'Ver em lista' }));
    const card = (await screen.findByText('Thyago')).closest('[id^="visita-"]') as HTMLElement;
    expect(within(card).getByRole('button', { name: /Não compareceu/ })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /^Remarcar$/ })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /Realizada/ })).toBeInTheDocument();
  });
});

describe('Agenda de Visitas: aba Agendadas da Lista', () => {
  it('pede Agendada e Reagendada: visita remarcada continua na aba', async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('button', { name: 'Ver em lista' }));
    await user.click(await screen.findByRole('button', { name: 'Agendadas' }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: ['scheduled', 'rescheduled'] })),
    );
  });

  it('as outras abas continuam pedindo uma situação só', async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('button', { name: 'Ver em lista' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmadas' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'confirmed' })));
  });
});

describe('Agenda de Visitas no celular (Raio-X do celular, 10/10/2026)', () => {
  let tela: ReturnType<typeof simularCelular> | null = null;
  afterEach(() => {
    tela?.restaurar();
    tela = null;
  });

  it('celular: abre na Lista, e Horário de visita e Folgas moram no ⋯', async () => {
    tela = simularCelular();
    const user = userEvent.setup();
    abrir();
    // Lista: os filtros por situação aparecem e a barra do mês não.
    expect(await screen.findByRole('button', { name: 'Todas' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Semana' })).toBeNull();
    // Nada de botão da agenda no topo: só o ⋯.
    const mais = await screen.findByRole('button', { name: 'Mais ações da agenda' });
    expect(screen.queryByRole('button', { name: /Horário de visita/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Folgas$/ })).toBeNull();
    await user.click(mais);
    expect(await screen.findByRole('menuitem', { name: /Horário de visita/ })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /^Folgas$/ }));
    expect(await screen.findByRole('heading', { name: 'Folgas' })).toBeInTheDocument();
  });

  it('celular: trocar pro Calendário continua possível', async () => {
    tela = simularCelular();
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('button', { name: 'Ver no calendário' }));
    expect(await screen.findByRole('radio', { name: 'Semana' })).toBeInTheDocument();
  });

  it('celular, corretor: o ⋯ só tem Minhas folgas', async () => {
    tela = simularCelular();
    list.mockResolvedValue({ data: [], meta: { total: 0, only_mine: true } });
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('button', { name: 'Mais ações da agenda' }));
    expect(await screen.findByRole('menuitem', { name: /Minhas folgas/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Horário de visita/ })).toBeNull();
  });

  it('computador: abre no Calendário, com os botões no topo e sem ⋯', async () => {
    tela = simularCelular(false);
    abrir();
    expect(await screen.findByRole('button', { name: /Horário de visita/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Semana' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mais ações da agenda' })).toBeNull();
  });
});

describe('Agenda de Visitas: erro de carga no Calendário', () => {
  beforeEach(() => {
    try { localStorage.removeItem('lm-visitas-visao'); } catch { /* sem armazenamento */ }
  });

  // Mês vazio por falha parecia agenda livre: quem agenda marcava em cima de horário ocupado.
  it('leitura que falha mostra Tentar de novo no Calendário, e a visita volta depois', async () => {
    list.mockRejectedValue(Object.assign(new Error('500'), { response: { status: 500 } }));
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('radio', { name: 'Mês' }));
    const botao = await screen.findByRole('button', { name: 'Tentar de novo' });

    const hoje = new Date();
    const as15 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 15, 0);
    list.mockResolvedValue({
      data: [{ id: 'v9', status: 'scheduled', scheduled_at: as15.toISOString(), duration_minutes: 60, contact: { id: 'c1', name: 'Thyago' } }],
      meta: { total: 1, active_total: 1, only_mine: false },
    });
    await user.click(botao);
    expect(await screen.findByRole('button', { name: /15:00 · Thyago/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
  });
});
