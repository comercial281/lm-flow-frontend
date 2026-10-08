// src/pages/Customer/Atividades/Atividades.spec.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const listar = vi.fn();
const concluir = vi.fn();
const estado = vi.hoisted(() => ({ perms: new Set<string>(), features: {} as Record<string, boolean> }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: () => ({ can: (r: string, a: string) => estado.perms.has(`${r}.${a}`), isReady: true }) }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useFeature: (k: string) => estado.features[k] !== false }));
// A janela de verdade tem teste próprio: aqui só interessa com que dados abre.
vi.mock('@/features/tarefas/JanelaDaTarefa', () => ({
  default: (p: { aberta: boolean; pipelineItemId?: string | null; categoriaInicial?: string; escolherLead?: boolean }) =>
    p.aberta ? <div data-testid="janela">{`card=${p.pipelineItemId ?? ''};cat=${p.categoriaInicial ?? ''};lead=${String(!!p.escolherLead)}`}</div> : null,
}));
vi.mock('@/features/tarefas/tarefasService', async () => {
  const real = await vi.importActual<typeof import('@/features/tarefas/tarefasService')>('@/features/tarefas/tarefasService');
  return { ...real, tarefasService: { listar: (...a: unknown[]) => listar(...a), concluir: (...a: unknown[]) => concluir(...a) } };
});
vi.mock('@/services/visits/visitsService', async () => ({ ...(await vi.importActual<object>('@/services/visits/visitsService')), visitsService: { realtors: async () => [{ id: 'u1', name: 'Ana' }, { id: 'u2', name: 'Bruno' }], leadPickerPage: async () => ({ data: [], meta: {} }) } }));
vi.mock('@/components/visits/ScheduleVisitDialog', () => ({ default: () => null, ScheduleVisitDialog: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import Atividades from './Atividades';

const resposta = (data: unknown[], onlyMine = false) => ({
  data,
  meta: { counts: { para_fazer: 3, hoje: 2, amanha: 0, atrasadas: 1, semana: 2, proxima_semana: 0, concluidas: 40 }, total: data.length, page: 1, per_page: 30, only_mine: onlyMine },
});

beforeEach(() => {
  listar.mockReset();
  concluir.mockReset();
  estado.perms = new Set(['visits.read', 'visits.create']);
  estado.features = {};
});

describe('Atividades', () => {
  it('abre em Vence hoje, com as contagens nas abas, tarefa e visita juntas', async () => {
    listar.mockResolvedValue(resposta([
      { kind: 'task', id: 't1', title: 'Ligar', due_at: new Date().toISOString(), status: 'pending', overdue: false, pipeline_item_id: 'c1', pipeline_id: 'p1', contact: { id: 'x', name: 'Carla' }, assignee: null, created_by_id: 'u1', can_edit: true, can_delete: true },
      { kind: 'visit', id: 'v1', title: 'Visita · Ap 12', due_at: new Date().toISOString(), status: 'scheduled', overdue: false, contact: { id: 'y', name: 'Rui' }, assignee: null },
    ]));
    render(<MemoryRouter><Atividades /></MemoryRouter>);
    expect(await screen.findByText('Ligar')).toBeInTheDocument();
    expect(screen.getByText('Visita · Ap 12')).toBeInTheDocument();
    expect(listar).toHaveBeenCalledWith(expect.objectContaining({ bucket: 'hoje' }));
    expect(screen.getByRole('button', { name: /Vence hoje \(2\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Concluídas \(40\)/ })).toBeInTheDocument();
  });

  it('trocar de aba pede o balde novo', async () => {
    listar.mockResolvedValue(resposta([]));
    render(<MemoryRouter><Atividades /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Atrasadas/ }));
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ bucket: 'atrasadas' })));
  });

  it('corretor (lista só dele) não vê o filtro de pessoa', async () => {
    listar.mockResolvedValue(resposta([], true));
    render(<MemoryRouter><Atividades /></MemoryRouter>);
    await screen.findByText('Nada pra hoje.');
    expect(screen.queryByLabelText('Pessoa')).not.toBeInTheDocument();
  });

  it('trocar de aba estando na página 2 pede uma vez só, na página 1', async () => {
    const muitas = { ...resposta([]), meta: { ...resposta([]).meta, total: 100 } };
    listar.mockResolvedValue(muitas);
    render(<MemoryRouter><Atividades /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    listar.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Atrasadas/ }));
    await waitFor(() => expect(listar).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 50));
    expect(listar).toHaveBeenCalledTimes(1);
    expect(listar).toHaveBeenCalledWith(expect.objectContaining({ bucket: 'atrasadas', page: 1 }));
  });

  it('resposta lenta que chega depois da nova não sobrescreve a tela', async () => {
    const tarefa = (id: string, title: string) => ({ kind: 'task', id, title, due_at: new Date().toISOString(), status: 'pending', overdue: false, pipeline_item_id: 'c1', pipeline_id: 'p1', contact: null, assignee: null, created_by_id: 'u1', can_edit: true, can_delete: true });
    let soltarPrimeira: (v: unknown) => void = () => {};
    listar.mockImplementationOnce(() => new Promise(r => { soltarPrimeira = r; }));
    listar.mockResolvedValueOnce(resposta([tarefa('t2', 'Segunda')]));
    render(<MemoryRouter><Atividades /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Atrasadas/ }));
    expect(await screen.findByText('Segunda')).toBeInTheDocument();
    soltarPrimeira(resposta([tarefa('t1', 'Primeira')]));
    await new Promise(r => setTimeout(r, 50));
    expect(screen.queryByText('Primeira')).not.toBeInTheDocument();
    expect(screen.getByText('Segunda')).toBeInTheDocument();
  });

  it('concluir pergunta pela próxima e abre a janela no card da tarefa concluída', async () => {
    concluir.mockResolvedValue({});
    listar.mockResolvedValue(resposta([
      { kind: 'task', id: 't1', title: 'Ligar', category: 'Oferta ativa', due_at: new Date().toISOString(), status: 'pending', overdue: false, pipeline_item_id: 'card-9', pipeline_id: 'p1', contact: { id: 'x', name: 'Carla' }, assignee: null, created_by_id: 'u1', can_edit: true, can_delete: true },
    ]));
    render(<MemoryRouter><Atividades /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('checkbox', { name: /concluir ligar/i }));
    await waitFor(() => expect(concluir).toHaveBeenCalledWith('t1'));
    await screen.findByText('Criar a próxima tarefa deste lead?');
    fireEvent.click(await screen.findByRole('button', { name: 'Nova tarefa' }));
    expect(await screen.findByTestId('janela')).toHaveTextContent('card=card-9;cat=Oferta ativa;lead=false');
  });

  it('"Agora não" na pergunta da próxima não abre janela', async () => {
    concluir.mockResolvedValue({});
    listar.mockResolvedValue(resposta([
      { kind: 'task', id: 't1', title: 'Ligar', due_at: new Date().toISOString(), status: 'pending', overdue: false, pipeline_item_id: 'card-9', pipeline_id: 'p1', contact: null, assignee: null, created_by_id: 'u1', can_edit: true, can_delete: true },
    ]));
    render(<MemoryRouter><Atividades /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('checkbox', { name: /concluir ligar/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Agora não' }));
    await new Promise(r => setTimeout(r, 50));
    expect(screen.queryByTestId('janela')).not.toBeInTheDocument();
  });

  it('com visitas liberadas mostra "Agendar visita" e "Só visitas"', async () => {
    listar.mockResolvedValue(resposta([]));
    render(<MemoryRouter><Atividades /></MemoryRouter>);
    await screen.findByText('Nada pra hoje.');
    expect(screen.getByRole('button', { name: 'Agendar visita' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Só visitas' })).toBeInTheDocument();
  });

  it('cliente sem a função Visitas não vê "Agendar visita" nem "Só visitas"', async () => {
    estado.features = { visits: false };
    listar.mockResolvedValue(resposta([]));
    render(<MemoryRouter><Atividades /></MemoryRouter>);
    await screen.findByText('Nada pra hoje.');
    expect(screen.queryByRole('button', { name: 'Agendar visita' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Só visitas' })).not.toBeInTheDocument();
  });

  it('cargo sem permissão de criar visita não vê "Agendar visita", mas vê "Só visitas"', async () => {
    estado.perms = new Set(['visits.read']);
    listar.mockResolvedValue(resposta([]));
    render(<MemoryRouter><Atividades /></MemoryRouter>);
    await screen.findByText('Nada pra hoje.');
    expect(screen.queryByRole('button', { name: 'Agendar visita' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Só visitas' })).toBeInTheDocument();
  });

  it('cargo sem permissão de ver visitas não vê nenhuma das duas', async () => {
    estado.perms = new Set();
    listar.mockResolvedValue(resposta([]));
    render(<MemoryRouter><Atividades /></MemoryRouter>);
    await screen.findByText('Nada pra hoje.');
    expect(screen.queryByRole('button', { name: 'Agendar visita' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Só visitas' })).not.toBeInTheDocument();
  });
});
