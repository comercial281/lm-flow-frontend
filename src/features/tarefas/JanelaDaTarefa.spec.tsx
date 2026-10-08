import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const criar = vi.fn();
const editar = vi.fn();
const concluir = vi.fn();
const contexto = vi.fn();
const agendaDoDia = vi.fn();
const gestor = vi.hoisted(() => ({ valor: false }));
vi.mock('./useEhGestor', () => ({ useEhGestor: () => gestor.valor }));
vi.mock('./tarefasService', async () => {
  const real = await vi.importActual<typeof import('./tarefasService')>('./tarefasService');
  return {
    ...real,
    tarefasService: {
      criar: (...a: unknown[]) => criar(...a),
      editar: (...a: unknown[]) => editar(...a),
      concluir: (...a: unknown[]) => concluir(...a),
      contexto: (...a: unknown[]) => contexto(...a),
      agendaDoDia: (...a: unknown[]) => agendaDoDia(...a),
    },
  };
});
vi.mock('@/services/visits/visitsService', () => ({ visitsService: { realtors: async () => [{ id: 'u1', name: 'Ana' }, { id: 'u2', name: 'Bruno' }], leadPickerPage: async () => ({ data: [{ id: 'l1', name: 'Carla', phone_number: '11999990000', in_pipeline: true }], meta: {} }) } }));
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { list: async () => ({ data: [{ id: 'p1', title: 'Apto Centro', code: 'AP0001' }] }) } }));
const lista = vi.hoisted(() => ({ opcoes: [] as unknown[] }));
vi.mock('@/services/listOptions/listOptionsService', () => ({ listOptionsService: { list: async () => lista.opcoes } }));
const op = (id: string, label: string, position: number, active = true) => ({ id, list_key: 'task_categories', label, position, active, meta_exclusion: false });
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) } }));

import JanelaDaTarefa from './JanelaDaTarefa';

const clicarEm = async (nome: string) => {
  const b = screen.getByRole('button', { name: nome });
  await waitFor(() => expect(b).toBeEnabled());
  fireEvent.click(b);
};
const tipos = () => within(screen.getByRole('group', { name: 'Tipo de tarefa' })).getAllByRole('button').map(b => b.textContent);
const titulo = () => screen.getByLabelText('Título da tarefa') as HTMLInputElement;
const noCard = () => render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} pipelineItemId="c1" />);

beforeEach(() => {
  lista.opcoes = [op('cat-fu', 'Follow-up', 0), op('cat-of', 'Oferta ativa', 1), op('cat-velha', 'Velha', 2, false)];
  for (const f of [criar, editar, concluir, contexto, agendaDoDia, toastError]) f.mockReset();
  contexto.mockResolvedValue({ pipeline_item_id: 'c1', pipeline_name: 'Funil de Vendas', contact: { id: 'ct1', name: 'Jucilene Barbosa' }, owner: { id: 'u1', name: 'Ana' } });
  agendaDoDia.mockResolvedValue([]);
  gestor.valor = false;
});

describe('JanelaDaTarefa', () => {
  const existente = { kind: 'task', id: 't9', title: 'Ligar', description: 'algo', category: 'Follow-up', due_at: '2026-10-09T13:00:00.000Z', duration_minutes: 30, priority: 'medium', property: { id: 'p9', title: 'Casa', code: 'CA0009' }, status: 'pending', overdue: false, pipeline_item_id: 'c1', pipeline_id: 'p1', contact: { id: 'ct1', name: 'Jucilene Barbosa' }, assignee: { id: 'u1', name: 'Ana' }, created_by_id: 'u1', can_edit: true, can_delete: true } as never;

  it('cria no card: título nasce com o tipo padrão e vão prioridade, duração e categoria', async () => {
    criar.mockResolvedValue({ kind: 'task', id: 't1' });
    const aoSalvar = vi.fn();
    render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={aoSalvar} pipelineItemId="c1" />);
    await waitFor(() => expect(titulo().value).toBe('Follow-up'));
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-10-09' } });
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '10:15' } });
    fireEvent.change(screen.getByLabelText('Prioridade'), { target: { value: 'high' } });
    fireEvent.change(screen.getByLabelText('Duração'), { target: { value: '30' } });
    await clicarEm('Salvar');
    await waitFor(() => expect(criar).toHaveBeenCalled());
    const dados = criar.mock.calls[0][0];
    expect(dados).toMatchObject({ pipeline_item_id: 'c1', title: 'Follow-up', category_option_id: 'cat-fu', priority: 'high', duration_minutes: 30 });
    expect(dados).not.toHaveProperty('completed');
    expect(dados).not.toHaveProperty('property_id');
    expect(new Date(dados.due_date).getHours()).toBe(10);
    expect(new Date(dados.due_date).getMinutes()).toBe(15);
    expect(aoSalvar).toHaveBeenCalled();
  });

  it('trocar o tipo troca o título automático, mas não o que a pessoa escreveu', async () => {
    noCard();
    await waitFor(() => expect(titulo().value).toBe('Follow-up'));
    fireEvent.click(screen.getByRole('button', { name: 'Oferta ativa' }));
    expect(titulo().value).toBe('Oferta ativa');
    fireEvent.change(titulo(), { target: { value: 'Mandar o book' } });
    fireEvent.click(screen.getByRole('button', { name: 'Follow-up' }));
    expect(titulo().value).toBe('Mandar o book');
    expect(screen.getByRole('button', { name: 'Follow-up' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('fechar e abrir de novo traz o título do tipo outra vez', async () => {
    const { rerender } = render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} pipelineItemId="c1" />);
    await waitFor(() => expect(titulo().value).toBe('Follow-up'));
    fireEvent.change(titulo(), { target: { value: 'Ligar pra ela' } });
    rerender(<JanelaDaTarefa aberta={false} aoFechar={() => {}} aoSalvar={() => {}} pipelineItemId="c1" />);
    rerender(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} pipelineItemId="c1" />);
    await waitFor(() => expect(titulo().value).toBe('Follow-up'));
  });

  it('mostra o lead e o atendimento do card', async () => {
    noCard();
    expect(await screen.findByText('Atendimento · Funil de Vendas')).toBeInTheDocument();
    expect(screen.getAllByText('Jucilene Barbosa').length).toBeGreaterThan(0);
    expect(contexto).toHaveBeenCalledWith({ pipeline_item_id: 'c1' });
  });

  it('sem título não chama o servidor', async () => {
    noCard();
    await waitFor(() => expect(titulo().value).toBe('Follow-up'));
    fireEvent.change(titulo(), { target: { value: '' } });
    await clicarEm('Salvar');
    expect(await screen.findByText('Escreva o que é pra fazer.')).toBeInTheDocument();
    expect(criar).not.toHaveBeenCalled();
  });

  it('lead sem card mostra o aviso certo', async () => {
    criar.mockRejectedValue({ response: { data: { error: { details: { motivo: 'lead_sem_card' } } } } });
    noCard();
    await waitFor(() => expect(titulo().value).toBe('Follow-up'));
    await clicarEm('Salvar');
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringContaining('ainda não está no funil')));
  });

  it('corretor não escolhe o responsável', async () => {
    noCard();
    await screen.findByText('Atendimento · Funil de Vendas');
    expect(screen.queryByRole('option', { name: 'Bruno' })).not.toBeInTheDocument();
  });

  it('gestor: o responsável do lead já vem escolhido e não vai pro servidor se não mudar', async () => {
    gestor.valor = true;
    criar.mockResolvedValue({ id: 't1' });
    noCard();
    await waitFor(() => expect(screen.getByLabelText('Corretor responsável')).toHaveValue('u1'));
    await clicarEm('Salvar');
    await waitFor(() => expect(criar).toHaveBeenCalled());
    expect(criar.mock.calls[0][0]).not.toHaveProperty('assigned_to_id');
  });

  it('gestor troca o responsável e ele vai pro servidor; a agenda acompanha', async () => {
    gestor.valor = true;
    criar.mockResolvedValue({ id: 't1' });
    noCard();
    await waitFor(() => expect(screen.getByLabelText('Corretor responsável')).toHaveValue('u1'));
    fireEvent.change(screen.getByLabelText('Corretor responsável'), { target: { value: 'u2' } });
    await waitFor(() => expect(agendaDoDia).toHaveBeenLastCalledWith(expect.any(String), 'u2'));
    await clicarEm('Salvar');
    await waitFor(() => expect(criar).toHaveBeenCalled());
    expect(criar.mock.calls[0][0]).toMatchObject({ assigned_to_id: 'u2' });
  });

  it('editar sem mexer não manda responsável, prioridade, duração nem imóvel', async () => {
    gestor.valor = true;
    editar.mockResolvedValue({ id: 't9' });
    render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} tarefa={existente} />);
    await waitFor(() => expect(screen.getByLabelText('Corretor responsável')).toHaveValue('u1'));
    expect(screen.getByLabelText('Prioridade')).toHaveValue('medium');
    expect(screen.getByLabelText('Duração')).toHaveValue('30');
    expect(screen.getByText('CA0009')).toBeInTheDocument();
    await clicarEm('Salvar');
    await waitFor(() => expect(editar).toHaveBeenCalled());
    const dados = editar.mock.calls[0][1];
    for (const campo of ['assigned_to_id', 'priority', 'duration_minutes', 'property_id', 'category_option_id']) expect(dados).not.toHaveProperty(campo);
  });

  it('hora em branco é erro, como a data', async () => {
    noCard();
    await waitFor(() => expect(titulo().value).toBe('Follow-up'));
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '' } });
    await clicarEm('Salvar');
    expect(await screen.findByText('Escolha a data.')).toBeInTheDocument();
    expect(criar).not.toHaveBeenCalled();
  });

  it('apagar a Observação ao editar manda texto vazio pro servidor limpar', async () => {
    editar.mockResolvedValue({ id: 't9' });
    render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} tarefa={existente} />);
    fireEvent.change(screen.getByLabelText('Observação'), { target: { value: '' } });
    await clicarEm('Salvar');
    await waitFor(() => expect(editar).toHaveBeenCalled());
    expect(editar.mock.calls[0][1].description).toBe('');
  });

  it('criar sem Observação não manda o campo', async () => {
    criar.mockResolvedValue({ id: 't1' });
    noCard();
    await waitFor(() => expect(titulo().value).toBe('Follow-up'));
    await clicarEm('Salvar');
    await waitFor(() => expect(criar).toHaveBeenCalled());
    expect(criar.mock.calls[0][0].description).toBeUndefined();
  });

  describe('imóvel', () => {
    it('busca e liga um imóvel', async () => {
      criar.mockResolvedValue({ id: 't1' });
      noCard();
      await waitFor(() => expect(titulo().value).toBe('Follow-up'));
      fireEvent.click(screen.getByRole('button', { name: 'Imóvel' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Imóvel' }), { target: { value: 'centro' } });
      fireEvent.click(await screen.findByRole('button', { name: /Apto Centro/ }));
      expect(screen.getByText('AP0001')).toBeInTheDocument();
      await clicarEm('Salvar');
      await waitFor(() => expect(criar).toHaveBeenCalled());
      expect(criar.mock.calls[0][0].property_id).toBe('p1');
    });

    it('tirar o imóvel ao editar manda property_id vazio', async () => {
      editar.mockResolvedValue({ id: 't9' });
      render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} tarefa={existente} />);
      fireEvent.click(screen.getByRole('button', { name: 'Tirar o imóvel' }));
      expect(screen.queryByText('CA0009')).not.toBeInTheDocument();
      await clicarEm('Salvar');
      await waitFor(() => expect(editar).toHaveBeenCalled());
      expect(editar.mock.calls[0][1].property_id).toBe('');
    });
  });

  describe('Marcar como concluída', () => {
    it('ao criar, a tarefa nasce concluída', async () => {
      criar.mockResolvedValue({ id: 't1' });
      noCard();
      await waitFor(() => expect(titulo().value).toBe('Follow-up'));
      fireEvent.click(screen.getByLabelText('Marcar como concluída'));
      await clicarEm('Salvar');
      await waitFor(() => expect(criar).toHaveBeenCalled());
      expect(criar.mock.calls[0][0].completed).toBe(true);
    });

    it('ao editar, salva e conclui', async () => {
      editar.mockResolvedValue({ id: 't9' });
      concluir.mockResolvedValue({ id: 't9', status: 'completed' });
      render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} tarefa={existente} />);
      fireEvent.click(screen.getByLabelText('Marcar como concluída'));
      await clicarEm('Salvar');
      await waitFor(() => expect(concluir).toHaveBeenCalledWith('t9'));
      expect(editar).toHaveBeenCalled();
    });
  });

  describe('agenda do dia', () => {
    it('mostra os itens do dia da data escolhida e as setas mudam o dia sem mudar a data', async () => {
      agendaDoDia.mockResolvedValue([{ kind: 'visit', id: 'v1', title: 'Visita · Casa', due_at: '2026-10-09T17:00:00.000Z', duration_minutes: 60, status: 'scheduled', contact: { id: 'ct2', name: 'Paulo' } }]);
      render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} tarefa={existente} />);
      expect(await screen.findByText('Visita · Casa')).toBeInTheDocument();
      expect(agendaDoDia).toHaveBeenCalledWith('2026-10-09', 'u1');
      fireEvent.click(screen.getByRole('button', { name: 'Próximo dia' }));
      await waitFor(() => expect(agendaDoDia).toHaveBeenLastCalledWith('2026-10-10', 'u1'));
      expect(screen.getByLabelText('Data')).toHaveValue('2026-10-09');
    });

    it('dia vazio diz "Sem tarefas para o dia"', async () => {
      noCard();
      expect(await screen.findByText('Sem tarefas para o dia')).toBeInTheDocument();
    });
  });

  it('na escolha de lead mostra o telefone e o link pra mudar diz "Trocar"', async () => {
    contexto.mockResolvedValue({ pipeline_item_id: 'c7', pipeline_name: 'Funil', contact: { id: 'l1', name: 'Carla' }, owner: null });
    render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} escolherLead />);
    const linha = await screen.findByText('11999990000');
    fireEvent.click(linha);
    expect(await screen.findByRole('button', { name: 'Trocar' })).toBeInTheDocument();
    expect(contexto).toHaveBeenCalledWith({ contact_id: 'l1' });
  });

  it('lead escolhido fora do funil avisa na hora', async () => {
    contexto.mockRejectedValue({ response: { data: { error: { details: { motivo: 'lead_sem_card' } } } } });
    render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} escolherLead />);
    fireEvent.click(await screen.findByText('11999990000'));
    expect(await screen.findByText(/ainda não está no funil/)).toBeInTheDocument();
  });

  describe('categoria da lista', () => {
    const comCategoria = (extra: Record<string, unknown>) => ({ ...(existente as object), ...extra }) as never;

    it('os botões mostram só as ativas, na ordem', async () => {
      noCard();
      await screen.findByRole('button', { name: 'Oferta ativa' });
      expect(tipos()).toEqual(['Follow-up', 'Oferta ativa']);
    });

    it('manda o id do tipo escolhido', async () => {
      criar.mockResolvedValue({ id: 't1' });
      noCard();
      fireEvent.click(await screen.findByRole('button', { name: 'Oferta ativa' }));
      await clicarEm('Salvar');
      await waitFor(() => expect(criar).toHaveBeenCalled());
      expect(criar.mock.calls[0][0].category_option_id).toBe('cat-of');
      expect(criar.mock.calls[0][0]).not.toHaveProperty('category');
    });

    it('categoriaInicial (id) vale quando ainda está ativa; arquivada cai na primeira ativa', async () => {
      const { unmount } = render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} pipelineItemId="c1" categoriaInicial="cat-of" />);
      await waitFor(() => expect(screen.getByRole('button', { name: 'Oferta ativa' })).toHaveAttribute('aria-pressed', 'true'));
      unmount();
      render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} pipelineItemId="c1" categoriaInicial="cat-velha" />);
      await waitFor(() => expect(screen.getByRole('button', { name: 'Follow-up' })).toHaveAttribute('aria-pressed', 'true'));
    });

    it('sem nenhuma categoria ativa: avisa e a tarefa sai sem categoria', async () => {
      lista.opcoes = [op('cat-velha', 'Velha', 0, false)];
      criar.mockResolvedValue({ id: 't1' });
      noCard();
      expect(await screen.findByText(/Nenhuma categoria/)).toBeInTheDocument();
      fireEvent.change(titulo(), { target: { value: 'Ligar' } });
      await clicarEm('Salvar');
      await waitFor(() => expect(criar).toHaveBeenCalled());
      expect(criar.mock.calls[0][0]).not.toHaveProperty('category_option_id');
    });

    it('tarefa com categoria arquivada: aparece "(arquivada)" e, sem mexer, não manda o id', async () => {
      editar.mockResolvedValue({ id: 't9' });
      render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} tarefa={comCategoria({ category: 'Velha', category_option_id: 'cat-velha' })} />);
      expect(await screen.findByRole('button', { name: 'Velha (arquivada)' })).toHaveAttribute('aria-pressed', 'true');
      await clicarEm('Salvar');
      await waitFor(() => expect(editar).toHaveBeenCalled());
      expect(editar.mock.calls[0][1]).not.toHaveProperty('category_option_id');
      expect(editar.mock.calls[0][1]).not.toHaveProperty('category');
    });

    it('tarefa antiga só com nome: mostra o nome e não manda categoria se não mexer', async () => {
      editar.mockResolvedValue({ id: 't9' });
      render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} tarefa={comCategoria({ category: 'Nome solto', category_option_id: null })} />);
      expect(await screen.findByRole('button', { name: 'Nome solto' })).toBeInTheDocument();
      await clicarEm('Salvar');
      await waitFor(() => expect(editar).toHaveBeenCalled());
      expect(editar.mock.calls[0][1]).not.toHaveProperty('category_option_id');
    });

    it('editar e escolher outro tipo manda o id novo sem trocar o título', async () => {
      editar.mockResolvedValue({ id: 't9' });
      render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} tarefa={comCategoria({ category: 'Velha', category_option_id: 'cat-velha' })} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Oferta ativa' }));
      expect(titulo().value).toBe('Ligar');
      await clicarEm('Salvar');
      await waitFor(() => expect(editar).toHaveBeenCalled());
      expect(editar.mock.calls[0][1].category_option_id).toBe('cat-of');
    });

    it('enquanto as categorias carregam, o botão fica desligado; depois liga', async () => {
      noCard();
      expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled());
    });
  });
});
