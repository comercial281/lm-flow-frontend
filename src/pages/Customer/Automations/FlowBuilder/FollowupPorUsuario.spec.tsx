import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Follow-up por usuário (Fase 3, 21/10/2026): a aba Follow-up de Funis de
// mensagem. Uma lista só, em seções: "Da equipe", "Meus" e, pro gestor, "Dos
// corretores". Estrela "Meu padrão", selo "Padrão da conta" e, só pro gestor e
// só em follow-up da equipe, "Tornar padrão da conta".

const list = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const duplicate = vi.hoisted(() => vi.fn());
const myDefault = vi.hoisted(() => vi.fn());
const accountDefault = vi.hoisted(() => vi.fn());
const getAll = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const can = vi.hoisted(() => ({ manager: false }));

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: {
    list, create, duplicate, myDefault, accountDefault,
    get: vi.fn(), toggle: vi.fn(), archive: vi.fn(), destroy: vi.fn(), update: vi.fn(),
  },
  flowAutomationFoldersService: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/services/followupSequences/followupSequencesService', () => ({
  followupSequencesService: { getAll, getHistory: vi.fn() },
}));
vi.mock('@/components/flowAutomations/FlowTemplates', () => ({
  FlowTemplateList: () => null,
  FlowTemplatesDialog: () => null,
}));
vi.mock('sonner', () => ({ toast: { error: toastError, success: toastSuccess } }));
// Corretor de fábrica: só as chaves dos funis de mensagem. Gestor: a do follow-up.
vi.mock('@/hooks/useCan', () => ({
  useCan: () => (resource: string, action: string) => {
    if (resource === 'message_funnels') return true;
    return can.manager && resource === 'followup_sequences' && ['read', 'update'].includes(action);
  },
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ currentUser: { id: 'u1' } }),
}));

import FlowAutomationsList from './FlowAutomationsList';

const corretor = { can_edit: true, guided: true, can_mark_team: false, can_create_blank: false, personal: true };
const soVer = { can_edit: false, guided: false, can_mark_team: false, can_create_blank: false, personal: false };
const gestor = { can_edit: true, guided: false, can_mark_team: true, can_create_blank: false, personal: false };

const fu = (id: string, name: string, patch: Record<string, unknown> = {}) => ({
  id, name, kind: 'followup', is_enabled: true, archived_at: null, live_count: 0,
  team: false, owner_user_id: 'u1', owner_name: 'Eu', my_default: false, account_default: false,
  trigger: { event: 'lead.stage_changed', conditions: [] },
  permissions: corretor,
  ...patch,
});
/** Follow-up sem dono (os de antes da Fase 3) é da equipe. */
const daEquipe = (id: string, name: string, patch: Record<string, unknown> = {}) =>
  fu(id, name, { owner_user_id: null, owner_name: null, permissions: soVer, ...patch });

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/lista']}>
      <Routes>
        <Route path="/lista" element={<FlowAutomationsList kind="followup" />} />
        <Route path="/automations/follow-ups/:id" element={<p>canvas do follow-up</p>} />
      </Routes>
    </MemoryRouter>,
  );

const secao = (nome: string) => screen.getByRole('region', { name: nome });
const itemDe = (nome: string) => screen.getByText(nome).closest('li')!;

beforeEach(() => {
  [list, create, duplicate, myDefault, accountDefault, getAll, toastError, toastSuccess].forEach(m => m.mockReset());
  getAll.mockResolvedValue([]);
  can.manager = false;
});

describe('Um título, um cartão (22/10/2026)', () => {
  it('título e subtítulo fixos de Funis de mensagem, botão e busca da aba Follow-up', async () => {
    list.mockResolvedValue([fu('m1', 'Meu reaquecimento')]);
    renderPage();
    await screen.findByText('Meu reaquecimento');
    expect(screen.getByRole('heading', { name: 'Funis de mensagem' })).toBeTruthy();
    expect(screen.getByText(
      'Sequências de mensagens prontas. As manuais você dispara numa conversa; o follow-up vai atrás do lead que parou de responder.',
    )).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Novo follow-up/ }).length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText('Buscar follow-up...')).toBeTruthy();
  });

  it('mesma grade de 3 colunas e mesmo cartão, com o filete na cor do estado', async () => {
    list.mockResolvedValue([
      fu('m1', 'Ligado um'),
      fu('m2', 'Desligado um', { is_enabled: false }),
      fu('m3', 'Arquivado um', { archived_at: '2026-10-01T00:00:00Z', is_enabled: false }),
    ]);
    renderPage();
    await screen.findByText('Ligado um');
    expect(screen.getByRole('list', { name: 'Meus' }).className).toContain('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3');
    expect(screen.getAllByTestId('cartao-de-fluxo')).toHaveLength(3);
    const estadoDe = (n: string) => screen.getByText(n).closest('[data-testid="cartao-de-fluxo"]')!.getAttribute('data-estado');
    expect(estadoDe('Ligado um')).toBe('ligado');
    expect(estadoDe('Desligado um')).toBe('desligado');
    expect(estadoDe('Arquivado um')).toBe('arquivado');
  });
});

describe('seções da lista', () => {
  it('corretor vê Da equipe e Meus; gestor vê também Dos corretores', async () => {
    list.mockResolvedValue([
      daEquipe('t1', 'Follow-up padrão'),
      fu('t2', 'Pós-visita da equipe', { team: true, owner_user_id: 'u9', owner_name: 'Gestora', permissions: soVer }),
      fu('m1', 'Meu reaquecimento'),
    ]);
    const { unmount } = renderPage();

    await screen.findByText('Meu reaquecimento');
    expect(within(secao('Da equipe')).getByText('Follow-up padrão')).toBeTruthy();
    expect(within(secao('Da equipe')).getByText('Pós-visita da equipe')).toBeTruthy();
    expect(within(secao('Meus')).getByText('Meu reaquecimento')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Dos corretores' })).toBeNull();
    // Sem abas internas: é uma lista só.
    expect(screen.queryByRole('tab')).toBeNull();
    unmount();

    can.manager = true;
    list.mockResolvedValue([
      daEquipe('t1', 'Follow-up padrão', { permissions: gestor }),
      fu('m1', 'Meu do gestor', { permissions: { ...gestor, personal: true } }),
      fu('c1', 'Do Bruno', { owner_user_id: 'u2', owner_name: 'Bruno', permissions: gestor }),
    ]);
    renderPage();
    await screen.findByText('Do Bruno');
    expect(within(secao('Da equipe')).getByText('Follow-up padrão')).toBeTruthy();
    expect(within(secao('Meus')).getByText('Meu do gestor')).toBeTruthy();
    const dosCorretores = secao('Dos corretores');
    expect(within(dosCorretores).getByText('Do Bruno')).toBeTruthy();
    expect(within(dosCorretores).getByText('De Bruno')).toBeTruthy();
  });

  it('corretor: o da equipe é só ver (Ver e Duplicar, sem Ligar/Excluir); o dele tem Editar', async () => {
    list.mockResolvedValue([daEquipe('t1', 'Follow-up padrão'), fu('m1', 'Meu reaquecimento')]);
    renderPage();
    await screen.findByText('Meu reaquecimento');

    const daEquipeItem = itemDe('Follow-up padrão');
    expect(within(daEquipeItem).getByRole('button', { name: 'Ver' })).toBeTruthy();
    expect(within(daEquipeItem).getByRole('button', { name: 'Duplicar pra ter a sua cópia' })).toBeTruthy();
    expect(within(daEquipeItem).queryByTitle('Desligar')).toBeNull();
    expect(within(daEquipeItem).queryByTitle('Excluir')).toBeNull();

    const meu = itemDe('Meu reaquecimento');
    fireEvent.click(within(meu).getByRole('button', { name: 'Editar' }));
    expect(await screen.findByText('canvas do follow-up')).toBeTruthy();
  });
});

describe('Meu padrão', () => {
  it('estrela marca meu padrão', async () => {
    list.mockResolvedValue([
      daEquipe('t1', 'Follow-up padrão', { my_default: true }),
      fu('m1', 'Meu reaquecimento'),
    ]);
    myDefault.mockResolvedValue(fu('m1', 'Meu reaquecimento', { my_default: true }));
    renderPage();
    await screen.findByText('Meu reaquecimento');

    const estrelaDaEquipe = within(itemDe('Follow-up padrão')).getByRole('button', { name: 'Meu padrão' });
    expect(estrelaDaEquipe.getAttribute('aria-pressed')).toBe('true');
    const estrela = within(itemDe('Meu reaquecimento')).getByRole('button', { name: 'Meu padrão' });
    expect(estrela.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(estrela);
    await waitFor(() => expect(myDefault).toHaveBeenCalledWith('m1', true));
    // Só um é o meu padrão: o anterior apaga.
    await waitFor(() => expect(within(itemDe('Meu reaquecimento')).getByRole('button', { name: 'Meu padrão' }).getAttribute('aria-pressed')).toBe('true'));
    expect(within(itemDe('Follow-up padrão')).getByRole('button', { name: 'Meu padrão' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('desmarcar manda on: false; a recusa do servidor aparece como veio', async () => {
    list.mockResolvedValue([fu('m1', 'Meu reaquecimento', { my_default: true, is_enabled: false })]);
    myDefault.mockRejectedValue({ response: { status: 422, data: { errors: ['Ligue o follow-up antes de marcar como seu padrão.'] } } });
    renderPage();
    await screen.findByText('Meu reaquecimento');
    fireEvent.click(within(itemDe('Meu reaquecimento')).getByRole('button', { name: 'Meu padrão' }));
    await waitFor(() => expect(myDefault).toHaveBeenCalledWith('m1', false));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Ligue o follow-up antes de marcar como seu padrão.'));
  });

  it('gestor não marca como padrão dele o follow-up de um corretor', async () => {
    can.manager = true;
    list.mockResolvedValue([fu('c1', 'Do Bruno', { owner_user_id: 'u2', owner_name: 'Bruno', permissions: gestor })]);
    renderPage();
    await screen.findByText('Do Bruno');
    expect(within(itemDe('Do Bruno')).queryByRole('button', { name: 'Meu padrão' })).toBeNull();
  });
});

describe('Padrão da conta', () => {
  it('Tornar padrão da conta só pro gestor e só em da equipe', async () => {
    can.manager = true;
    list.mockResolvedValue([
      daEquipe('t1', 'Follow-up padrão', { account_default: true, permissions: gestor }),
      fu('t2', 'Pós-visita', { team: true, permissions: gestor }),
      fu('t3', 'Desligado da equipe', { team: true, is_enabled: false, permissions: gestor }),
      fu('m1', 'Meu do gestor', { permissions: { ...gestor, personal: true } }),
      fu('c1', 'Do Bruno', { owner_user_id: 'u2', owner_name: 'Bruno', permissions: gestor }),
    ]);
    accountDefault.mockResolvedValue(fu('t2', 'Pós-visita', { team: true, account_default: true, permissions: gestor }));
    const { unmount } = renderPage();
    await screen.findByText('Pós-visita');

    expect(within(itemDe('Follow-up padrão')).getByText('Padrão da conta')).toBeTruthy();
    expect(within(itemDe('Follow-up padrão')).queryByRole('button', { name: 'Tornar padrão da conta' })).toBeNull();
    expect(within(itemDe('Meu do gestor')).queryByRole('button', { name: 'Tornar padrão da conta' })).toBeNull();
    expect(within(itemDe('Do Bruno')).queryByRole('button', { name: 'Tornar padrão da conta' })).toBeNull();
    // Desligado não vira padrão da conta (o servidor recusaria).
    expect(within(itemDe('Desligado da equipe')).queryByRole('button', { name: 'Tornar padrão da conta' })).toBeNull();

    fireEvent.click(within(itemDe('Pós-visita')).getByRole('button', { name: 'Tornar padrão da conta' }));
    await waitFor(() => expect(accountDefault).toHaveBeenCalledWith('t2'));
    // O selo muda de lugar: só um é o padrão da conta.
    await waitFor(() => expect(within(itemDe('Pós-visita')).getByText('Padrão da conta')).toBeTruthy());
    expect(within(itemDe('Follow-up padrão')).queryByText('Padrão da conta')).toBeNull();
    unmount();

    // Corretor: vê o selo, nunca a ação.
    can.manager = false;
    list.mockResolvedValue([
      daEquipe('t1', 'Follow-up padrão', { account_default: true }),
      daEquipe('t2', 'Pós-visita'),
    ]);
    renderPage();
    await screen.findByText('Pós-visita');
    expect(within(itemDe('Follow-up padrão')).getByText('Padrão da conta')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tornar padrão da conta' })).toBeNull();
  });
});

describe('Novo follow-up', () => {
  it('Novo follow-up do corretor nasce dele (sem escolher, sem team)', async () => {
    list.mockResolvedValue([daEquipe('t1', 'Follow-up padrão')]);
    create.mockResolvedValue({ id: 'novo', kind: 'followup' });
    renderPage();
    await screen.findByText('Follow-up padrão');

    fireEvent.click(screen.getAllByRole('button', { name: /Novo follow-up/ })[0]);
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Novo follow-up', kind: 'followup' }));
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(await screen.findByText('canvas do follow-up')).toBeTruthy();
  });

  it('gestor escolhe Da equipe (padrão) ou Só meu antes de criar', async () => {
    can.manager = true;
    list.mockResolvedValue([daEquipe('t1', 'Follow-up padrão', { permissions: gestor })]);
    create.mockResolvedValue({ id: 'novo', kind: 'followup' });
    const { unmount } = renderPage();
    await screen.findByText('Follow-up padrão');

    fireEvent.click(screen.getAllByRole('button', { name: /Novo follow-up/ })[0]);
    const janela = await screen.findByRole('dialog');
    expect(within(janela).getByRole('radio', { name: /Da equipe/ }).getAttribute('aria-checked')).toBe('true');
    expect(within(janela).getByRole('radio', { name: /Só meu/ }).getAttribute('aria-checked')).toBe('false');
    expect(create).not.toHaveBeenCalled();
    fireEvent.click(within(janela).getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Novo follow-up', kind: 'followup', team: true }));
    unmount();

    create.mockClear();
    renderPage();
    await screen.findByText('Follow-up padrão');
    fireEvent.click(screen.getAllByRole('button', { name: /Novo follow-up/ })[0]);
    const outra = await screen.findByRole('dialog');
    fireEvent.click(within(outra).getByRole('radio', { name: /Só meu/ }));
    fireEvent.click(within(outra).getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Novo follow-up', kind: 'followup', team: false }));
  });
});

describe('Duplicar', () => {
  it('Duplicar chama duplicate e abre a cópia (corretor: a cópia é dele)', async () => {
    list.mockResolvedValue([daEquipe('t1', 'Follow-up padrão')]);
    duplicate.mockResolvedValue(fu('copia', 'Follow-up padrão (cópia)'));
    renderPage();
    await screen.findByText('Follow-up padrão');

    fireEvent.click(within(itemDe('Follow-up padrão')).getByRole('button', { name: 'Duplicar pra ter a sua cópia' }));
    await waitFor(() => expect(duplicate).toHaveBeenCalledWith('t1'));
    expect(await screen.findByText('canvas do follow-up')).toBeTruthy();
    expect(toastSuccess).toHaveBeenCalledWith('Follow-up duplicado: a cópia é sua.');
  });

  it('gestor escolhe de quem é a cópia (começa como o original)', async () => {
    can.manager = true;
    list.mockResolvedValue([daEquipe('t1', 'Follow-up padrão', { permissions: gestor })]);
    duplicate.mockResolvedValue(fu('copia', 'Follow-up padrão (cópia)', { team: true, permissions: gestor }));
    renderPage();
    await screen.findByText('Follow-up padrão');

    fireEvent.click(within(itemDe('Follow-up padrão')).getByRole('button', { name: 'Duplicar' }));
    const janela = await screen.findByRole('dialog');
    expect(within(janela).getByRole('radio', { name: /Da equipe/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(janela).getByRole('button', { name: 'Duplicar' }));
    await waitFor(() => expect(duplicate).toHaveBeenCalledWith('t1', { team: true }));
  });
});
