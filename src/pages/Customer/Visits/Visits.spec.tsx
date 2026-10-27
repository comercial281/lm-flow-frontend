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
const leadSummary = vi.fn();
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
      // A prévia do hover pede o resumo depois de 450 ms parado em cima.
      leadSummary: (...a: unknown[]) => leadSummary(...a),
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
import { esquecerResumos } from '@/features/visits/guardaDoResumo';
import { simularCelular } from '@/test/telaDeCelular';

// A agenda ligada ou não é o que o servidor responde em `GET /visit_settings`.
const LIGADA = { enabled: true, days: [1, 2, 3, 4, 5, 6], start: '08:00', end: '20:00', closed_dates: [], seeded_from: {} };

const abrir = () => render(<MemoryRouter><Visits /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  esquecerAgendaLigada();
  esquecerResumos();
  leadSummary.mockRejectedValue(new Error('sem resumo no teste'));
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

describe('Agenda de Visitas: calendário com a peça nova', () => {
  beforeEach(() => {
    try { localStorage.removeItem('lm-visitas-visao'); } catch { /* sem armazenamento */ }
  });
  const daIA = () => {
    const hoje = new Date();
    const as15 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 15, 0);
    list.mockResolvedValue({
      data: [{ id: 'v9', status: 'scheduled', booked_by: 'ia', scheduled_at: as15.toISOString(), duration_minutes: 60, contact: { id: 'c1', name: 'Maria de Souza' } }],
      meta: { total: 1, active_total: 1, only_mine: false },
    });
  };

  it('o Mês desenha a visita da IA com o robô', async () => {
    daIA();
    abrir();
    const peca = await screen.findByRole('button', { name: /Maria S\. ?|Maria de Souza.*Agendada pela IA Vendedora/ });
    expect(peca.getAttribute('aria-label')).toContain('Agendada pela IA Vendedora');
    expect(peca.id).toBe('visita-v9');
    expect(peca.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  // O jsdom não tem PointerEvent: o tipo do ponteiro vai pendurado num MouseEvent.
  const passarOMouse = (el: Element) =>
    fireEvent(el, Object.assign(new MouseEvent('pointerover', { bubbles: true }), { pointerType: 'mouse' }));

  it('parar o mouse na visita do Mês mostra a prévia do lead', async () => {
    daIA();
    leadSummary.mockResolvedValue({
      contact: { id: 'c1', name: 'Maria de Souza', phone_number: '11984123307' },
      card: { pipeline_name: 'Vendas', stage_name: 'Visita agendada', status: 'open', other_cards_count: 0 },
      origin_label: null, owner: null, labels: [], last_message: null, conversation_id: null, ia: null,
      previous_visits_count: 0, lead_created_at: null, card_entered_at: null,
    });
    abrir();
    const peca = await screen.findByRole('button', { name: /Maria de Souza/ });
    passarOMouse(peca);
    expect(peca).toHaveClass('armando');
    expect(leadSummary).not.toHaveBeenCalled();
    const previa = await screen.findByRole('region', { name: 'Resumo do lead' }, { timeout: 2000 });
    expect(leadSummary).toHaveBeenCalledWith('v9');
    expect(await within(previa).findByText('(11) 98412-3307')).toBeInTheDocument();
    expect(within(previa).getByTestId('funil-do-lead')).toHaveTextContent('Vendas›Visita agendada');
  });

  const RESUMO_MARIA = {
    contact: { id: 'c1', name: 'Maria de Souza', phone_number: '11984123307' },
    card: null, origin_label: null, owner: null, labels: [], last_message: null, conversation_id: null, ia: null,
    previous_visits_count: 0, lead_created_at: null, card_entered_at: null,
  };

  it('clicar dentro da prévia aberta no Mês não abre o Agendar visita do dia', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 10, 11, 0));
    try {
      daIA();
      leadSummary.mockResolvedValue(RESUMO_MARIA);
      abrir();
      passarOMouse(await screen.findByRole('button', { name: /Maria de Souza/ }));
      const previa = await screen.findByRole('region', { name: 'Resumo do lead' }, { timeout: 2000 });
      const nome = await within(previa).findByText('(11) 98412-3307');
      fireEvent.pointerDown(nome);
      fireEvent.mouseDown(nome);
      fireEvent.click(nome);
      expect(screen.queryByTestId('janela')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clicar dentro da prévia aberta na Semana não abre o Agendar visita do horário', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 10, 11, 0));
    try {
      daIA();
      leadSummary.mockResolvedValue(RESUMO_MARIA);
      const user = userEvent.setup();
      abrir();
      await user.click(await screen.findByRole('radio', { name: 'Semana' }));
      passarOMouse(await screen.findByRole('button', { name: /15:00–16:00 · Maria de Souza/ }));
      const previa = await screen.findByRole('region', { name: 'Resumo do lead' }, { timeout: 2000 });
      const nome = await within(previa).findByText('(11) 98412-3307');
      // 22h na grade: horário futuro, que abriria o Agendar visita se o clique vazasse.
      fireEvent.click(nome, { clientY: 22 * 48 });
      expect(screen.queryByTestId('janela')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('o bloco da Semana também arma a prévia', async () => {
    daIA();
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('radio', { name: 'Semana' }));
    const bloco = await screen.findByRole('button', { name: /15:00–16:00 · Maria de Souza/ });
    passarOMouse(bloco);
    expect(bloco).toHaveClass('armando');
    expect(bloco.style.top).not.toBe(''); // a posição do bloco continua
  });

  it('a Semana desenha o bloco com o nome e o robô', async () => {
    daIA();
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('radio', { name: 'Semana' }));
    const bloco = await screen.findByRole('button', { name: /15:00–16:00 · Maria de Souza · Agendada · Agendada pela IA Vendedora/ });
    expect(bloco.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(bloco.textContent).toContain('Maria de Souza');
  });

  it('a legenda mostra as 7 situações e a visita que passou sem registro', async () => {
    abrir();
    const legenda = await screen.findByRole('list', { name: 'Legenda das situações da visita' });
    const itens = within(legenda).getAllByRole('listitem').map(li => li.textContent);
    expect(itens).toEqual(['Agendada', 'Confirmada', 'Em andamento', 'Reagendada', 'Realizada', 'Não compareceu', 'Cancelada', 'Passou e ninguém registrou']);
  });

  it('o dia de hoje no Mês tem o número no círculo da marca e a célula sem fundo roxo', async () => {
    abrir();
    const n = await screen.findByTestId('numero-de-hoje');
    expect(n.className).toContain('bg-primary');
    expect(n.className).toContain('text-primary-foreground');
    expect(n.parentElement!.className).not.toContain('bg-primary/');
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

  it('clique na visita abre a janela com o resumo do lead em cima', async () => {
    const hoje = new Date();
    const as15 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 15, 0);
    const visita = { id: 'v3', status: 'scheduled', booked_by: 'ia', scheduled_at: as15.toISOString(), duration_minutes: 60, contact: { id: 'c1', name: 'Maria de Souza' } };
    list.mockResolvedValue({ data: [visita], meta: { total: 1, active_total: 1, only_mine: false } });
    leadSummary.mockResolvedValue({
      contact: { id: 'c1', name: 'Maria de Souza', phone_number: '11984123307' },
      card: { pipeline_name: 'Vendas', stage_name: 'Visita agendada', status: 'open', other_cards_count: 0 },
      origin_label: null, owner: null, labels: [], last_message: null, conversation_id: 'conv9', ia: null,
      previous_visits_count: 0, lead_created_at: null, card_entered_at: null,
    });
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('radio', { name: 'Semana' }));
    await user.click(await screen.findByRole('button', { name: /15:00–16:00 · Maria/ }));
    const janela = await screen.findByRole('dialog');
    const lead = await within(janela).findByRole('group', { name: 'Lead' });
    expect(await within(lead).findByText('(11) 98412-3307')).toBeInTheDocument();
    expect(within(lead).getByRole('link', { name: /Abrir conversa/ })).toHaveAttribute('href', '/conversations/conv9');
    const visitaSecao = within(janela).getByRole('group', { name: 'Visita' });
    expect(within(visitaSecao).getByRole('img', { name: /IA Vendedora/ })).toBeInTheDocument();
    // Lead vem antes da visita na janela.
    expect(lead.compareDocumentPosition(visitaSecao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(janela).getByRole('button', { name: /^Remarcar$/ })).toBeInTheDocument();
  });

  it('resumo que falha não tira os botões', async () => {
    const hoje = new Date();
    const as15 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 15, 0);
    const visita = { id: 'v4', status: 'scheduled', scheduled_at: as15.toISOString(), duration_minutes: 60, contact: { id: 'c1', name: 'Thyago' } };
    list.mockResolvedValue({ data: [visita], meta: { total: 1, active_total: 1, only_mine: false } });
    leadSummary.mockRejectedValue(new Error('falhou'));
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('radio', { name: 'Semana' }));
    await user.click(await screen.findByRole('button', { name: /15:00–16:00 · Thyago/ }));
    const janela = await screen.findByRole('dialog');
    expect(await within(janela).findByText('Não deu para carregar o resumo do lead.')).toBeInTheDocument();
    expect(within(janela).getByRole('button', { name: /^Remarcar$/ })).toBeInTheDocument();
    expect(within(janela).getByRole('button', { name: /Cancelar/ })).toBeInTheDocument();
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

describe('Agenda de Visitas: Lista no mesmo cartão', () => {
  afterEach(() => { vi.useRealTimers(); });
  beforeEach(() => {
    pararRelogio();
    try { localStorage.removeItem('lm-visitas-visao'); } catch { /* sem armazenamento */ }
  });

  const umaVisita = () => {
    const hoje = new Date();
    const as15 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 15, 0);
    const visita = { id: 'v7', status: 'scheduled', booked_by: 'ia', scheduled_at: as15.toISOString(), duration_minutes: 60, contact: { id: 'c1', name: 'Maria de Souza' } };
    list.mockResolvedValue({ data: [visita], meta: { total: 1, active_total: 1, only_mine: false } });
  };

  it('Lista e Calendário usam o mesmo cartão', async () => {
    umaVisita();
    const user = userEvent.setup();
    abrir();
    const doCalendario = await screen.findByTestId('agenda-cartao');
    await user.click(screen.getByRole('button', { name: 'Ver em lista' }));
    const daLista = await screen.findByTestId('agenda-cartao');
    expect(daLista.className).toBe(doCalendario.className);
    expect(daLista.className).not.toContain('max-w-3xl');
    expect(await within(daLista).findByText('Maria de Souza')).toBeInTheDocument();
  });

  it('nome do lead na Lista abre a janela com o resumo', async () => {
    umaVisita();
    leadSummary.mockResolvedValue({
      contact: { id: 'c1', name: 'Maria de Souza', phone_number: '11984123307' },
      card: null, origin_label: null, owner: null, labels: [], last_message: null, conversation_id: 'conv7', ia: null,
      previous_visits_count: 0, lead_created_at: null, card_entered_at: null,
    });
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('button', { name: 'Ver em lista' }));
    await user.click(await screen.findByRole('button', { name: 'Maria de Souza' }));
    const janela = await screen.findByRole('dialog');
    const lead = await within(janela).findByRole('group', { name: 'Lead' });
    expect(await within(lead).findByRole('link', { name: /Abrir conversa/ })).toHaveAttribute('href', '/conversations/conv7');
  });

  it('estrelas da nota na janela e na Lista usam a mesma cor, sem roxo', async () => {
    const hoje = new Date();
    const as15 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 15, 0);
    const visita = { id: 'v8', status: 'completed', rating: 4, scheduled_at: as15.toISOString(), duration_minutes: 60, contact: { id: 'c1', name: 'Maria de Souza' } };
    list.mockResolvedValue({ data: [visita], meta: { total: 1, active_total: 1, only_mine: false } });
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('button', { name: 'Ver em lista' }));
    const linha = (await screen.findByText('Maria de Souza')).closest('[id^="visita-"]') as HTMLElement;
    expect(linha.querySelector('svg.lucide-star.fill-amber-400')).not.toBeNull();
    await user.click(within(linha).getByRole('button', { name: 'Maria de Souza' }));
    const janela = await screen.findByRole('dialog');
    const estrelas = janela.querySelectorAll('svg.lucide-star');
    expect(estrelas.length).toBe(5);
    expect(janela.querySelector('svg.lucide-star.fill-amber-400')).not.toBeNull();
    expect(janela.innerHTML).not.toContain('violet');
  });

  it('Atrasada no cartão da janela só vale para Agendada/Confirmada, como na Lista', async () => {
    const ontem = new Date(Date.now() - 26 * 3600 * 1000);
    const visita = { id: 'v9', status: 'in_progress', scheduled_at: ontem.toISOString(), duration_minutes: 60, contact: { id: 'c1', name: 'Maria de Souza' } };
    list.mockResolvedValue({ data: [visita], meta: { total: 1, active_total: 1, only_mine: false } });
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('button', { name: 'Ver em lista' }));
    const linha = (await screen.findByText('Maria de Souza')).closest('[id^="visita-"]') as HTMLElement;
    expect(within(linha).queryByText('Atrasada')).toBeNull();
    await user.click(within(linha).getByRole('button', { name: 'Maria de Souza' }));
    const janela = await screen.findByRole('dialog');
    expect(within(janela).queryByText('Atrasada')).toBeNull();
  });

  it('janela: botões da visita ficam na seção "O que aconteceu"; encerrada sem botão não mostra seção vazia', async () => {
    const hoje = new Date();
    const as15 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 15, 0);
    const aberta = { id: 'v10', status: 'scheduled', scheduled_at: as15.toISOString(), duration_minutes: 60, contact: { id: 'c1', name: 'Maria de Souza' } };
    list.mockResolvedValue({ data: [aberta], meta: { total: 1, active_total: 1, only_mine: false } });
    const user = userEvent.setup();
    const { unmount } = abrir();
    await user.click(await screen.findByRole('button', { name: 'Ver em lista' }));
    await user.click(await screen.findByRole('button', { name: 'Maria de Souza' }));
    const janela = await screen.findByRole('dialog');
    const secao = within(janela).getByRole('group', { name: 'O que aconteceu' });
    expect(within(secao).getByRole('button', { name: /^Remarcar$/ })).toBeInTheDocument();
    unmount();

    const cancelada = { ...aberta, id: 'v11', status: 'cancelled' };
    list.mockResolvedValue({ data: [cancelada], meta: { total: 1, active_total: 1, only_mine: false } });
    abrir();
    await user.click(await screen.findByRole('button', { name: 'Ver em lista' }));
    await user.click(await screen.findByRole('button', { name: 'Maria de Souza' }));
    const janela2 = await screen.findByRole('dialog');
    expect(within(janela2).queryByRole('group', { name: 'O que aconteceu' })).toBeNull();
    expect(within(janela2).queryByText('O que aconteceu')).toBeNull();
  });
});
