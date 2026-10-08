// src/pages/Customer/Pipelines/PipelineKanban.spec.tsx
// Quadro do funil montado de verdade, com os serviços falsos. Começou (P3-T10)
// como caracterização: o que a divisão do PipelineKanban não pode mudar.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { pipelinesService } from '@/services/pipelines';
import type { Pipeline, PipelineItem, PipelineStage } from '@/types/analytics';
import PipelineKanban from './PipelineKanban';

const mocks = vi.hoisted(() => ({ abrirConversa: vi.fn(), fetchLabels: vi.fn() }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn() } }));
vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (chave: string, reserva?: unknown) => (typeof reserva === 'string' ? reserva : chave) }),
}));
// As janelas do quadro são lazy (código só no clique): no teste, nenhuma monta.
vi.mock('@/utils/chunkReload', () => ({ lazyWithRetry: () => () => null }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useFeature: () => true }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => () => true }));
vi.mock('@/hooks/useOpenLeadConversation', () => ({
  useOpenLeadConversation: () => ({ openLeadConversation: mocks.abrirConversa, startConversationModal: null, opening: false }),
}));
vi.mock('@/store/appDataStore', () => ({ useAppDataStore: () => ({ labels: [], fetchLabels: mocks.fetchLabels }) }));
vi.mock('@/services/visits/visitsService', () => ({ visitsService: { list: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('@/components/roleta/OfferActions', () => ({
  default: ({ fallback }: { fallback?: React.ReactNode }) => <>{fallback ?? null}</>,
}));
vi.mock('@/pages/Customer/Pipelines/pipelinePayloadCache', () => ({
  getCachedPipeline: () => undefined,
  setCachedPipeline: vi.fn(),
  prefetchPipeline: vi.fn(),
}));
vi.mock('@/services/listOptions/listOptionsService', () => ({ listOptionsService: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/services/pipelines', () => ({
  pipelinesService: {
    getPipeline: vi.fn(),
    getPipelines: vi.fn(),
    reorderItem: vi.fn(),
    archiveItem: vi.fn(),
    unarchiveItem: vi.fn(),
  },
}));

// 06/10/2026 12h em São Paulo.
const CHEGOU = 1_791_298_800;

const card = (id: string, nome: string, stageId: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    item_id: `c-${id}`,
    type: 'contact',
    pipeline_id: 'p1',
    stage_id: stageId,
    pipeline_stage_id: stageId,
    is_lead: true,
    created_at: CHEGOU,
    updated_at: CHEGOU,
    entered_at: CHEGOU,
    position: Number(id.replace(/\D/g, '')) || 1,
    status: 'open',
    contact: { id: `c-${id}`, name: nome, phone_number: '+5511999990000', email: `${id}@exemplo.com.br` },
    tasks_info: { pending_count: 0, overdue_count: 0, due_soon_count: 0, due_today_count: 0, completed_count: 0, total_count: 0 },
    ...extra,
  }) as unknown as PipelineItem;

const etapa = (id: string, name: string, items: PipelineItem[]) =>
  ({ id, name, color: '#3b82f6', position: id === 's1' ? 1 : 2, created_at: '', updated_at: '', items }) as unknown as PipelineStage;

const FUNIL = (s1: PipelineItem[] = [card('i1', 'Maria Souza', 's1')], s2: PipelineItem[] = [
  card('i2', 'João Lima', 's2'),
  card('i3', 'Paula Reis', 's2', { status: 'won', won_at: '2026-10-06T15:00:00Z' }),
]): Pipeline =>
  ({
    id: 'p1',
    name: 'Leads (Marketing)',
    pipeline_type: 'sale',
    visibility: 'public',
    is_active: true,
    created_at: '2026-10-01',
    updated_at: '2026-10-01',
    status_counts: { open: 2, won: 1, lost: 0, all: 3, archived: 1 },
    stages: [etapa('s1', 'Novo', s1), etapa('s2', 'Proposta', s2)],
  }) as unknown as Pipeline;

const BUSCA = 'Buscar lead';

function Endereco() {
  const { search } = useLocation();
  return <output data-testid="endereco">{search}</output>;
}

const montar = (endereco = '/pipelines/p1') =>
  render(
    <MemoryRouter initialEntries={[endereco]}>
      <Routes>
        <Route path="/pipelines/:pipelineId" element={<><PipelineKanban /><Endereco /></>} />
      </Routes>
    </MemoryRouter>,
  );

// Deixa terminar o que o quadro faz depois do evento, antes de afirmar que NADA aconteceu.
const esvaziar = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

const cardDe = (nome: string) => screen.getByText(nome).closest('[draggable]') as HTMLElement;
const colunaDe = (stageId: string) =>
  document.getElementById(`etapa-${stageId}`)!.querySelector('[data-col-scroll]') as HTMLElement;
const endereco = () => new URLSearchParams(screen.getByTestId('endereco').textContent ?? '');

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
  // O auto-rolar do arraste pergunta qual elemento está sob o cursor; o jsdom não sabe.
  document.elementFromPoint = (() => null) as typeof document.elementFromPoint;
  vi.mocked(pipelinesService.getPipelines).mockResolvedValue({ data: [] } as never);
  vi.mocked(pipelinesService.getPipeline).mockImplementation(async () => FUNIL());
  vi.mocked(pipelinesService.reorderItem).mockResolvedValue({ success: true, message: '' });
  vi.mocked(pipelinesService.archiveItem).mockResolvedValue({} as PipelineItem);
  vi.mocked(pipelinesService.unarchiveItem).mockResolvedValue({} as PipelineItem);
});

describe('quadro do funil · o que continua igual', () => {
  it('desenha as colunas e os cards de cada uma', async () => {
    montar();
    expect(await screen.findByText('Maria Souza')).toBeInTheDocument();
    expect(within(document.getElementById('etapa-s1')!).getByText('Novo')).toBeInTheDocument();
    expect(within(document.getElementById('etapa-s2')!).getByText('João Lima')).toBeInTheDocument();
  });

  it('a busca filtra os cards pelo nome', async () => {
    montar();
    await screen.findByText('Maria Souza');
    await userEvent.type(screen.getByPlaceholderText(BUSCA), 'maria');
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.queryByText('João Lima')).toBeNull();
  });

  it('arrastar um card para outra coluna grava a etapa nova e move na hora', async () => {
    montar();
    await screen.findByText('Maria Souza');
    fireEvent.dragStart(cardDe('Maria Souza'));
    fireEvent.dragOver(colunaDe('s2'));
    fireEvent.drop(colunaDe('s2'));
    await waitFor(() =>
      expect(pipelinesService.reorderItem).toHaveBeenCalledWith('p1', 'i1', expect.objectContaining({ new_stage_id: 's2' })),
    );
    expect(within(document.getElementById('etapa-s2')!).getByText('Maria Souza')).toBeInTheDocument();
  });

  it('card ganho não arrasta: reabre antes (E2)', async () => {
    montar();
    await screen.findByText('Paula Reis');
    expect(cardDe('Paula Reis')).toHaveAttribute('draggable', 'false');
    fireEvent.dragStart(cardDe('Paula Reis'));
    fireEvent.dragOver(colunaDe('s1'));
    fireEvent.drop(colunaDe('s1'));
    await esvaziar();
    expect(pipelinesService.reorderItem).not.toHaveBeenCalled();
    expect(within(document.getElementById('etapa-s2')!).getByText('Paula Reis')).toBeInTheDocument();
    expect(within(document.getElementById('etapa-s1')!).queryByText('Paula Reis')).toBeNull();
  });

  it('a Lista mostra os leads sem as colunas do quadro', async () => {
    montar();
    await screen.findByText('Maria Souza');
    await userEvent.click(screen.getByRole('radio', { name: 'Lista' }));
    expect(document.getElementById('etapa-s1')).toBeNull();
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getAllByText('Proposta').length).toBeGreaterThan(0);
  });

  it('arquivar pelo menu do card tira o card do quadro', async () => {
    montar();
    await screen.findByText('Maria Souza');
    await userEvent.click(within(cardDe('Maria Souza')).getByRole('button', { name: 'Mais ações' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Arquivar' }));
    await waitFor(() => expect(pipelinesService.archiveItem).toHaveBeenCalledWith('p1', 'i1'));
    expect(screen.queryByText('Maria Souza')).toBeNull();
  });

  it('o filtro de Tarefas (Filtros > Tarefas) esconde os cards sem tarefa que vence hoje / atrasada', async () => {
    const tarefas = (extra: Record<string, number>) => ({
      pending_count: 1, overdue_count: 0, due_soon_count: 0, due_today_count: 0, completed_count: 0, total_count: 1, ...extra,
    });
    vi.mocked(pipelinesService.getPipeline).mockImplementation(async () =>
      FUNIL(
        [card('i1', 'Maria Souza', 's1', { tasks_info: tarefas({ due_today_count: 1 }) })],
        [card('i2', 'João Lima', 's2', { tasks_info: tarefas({ overdue_count: 1 }) })],
      ),
    );
    montar();
    await screen.findByText('Maria Souza');
    expect(screen.getByText('João Lima')).toBeInTheDocument();

    const filtrarCom = async (...nomes: string[]) => {
      await userEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
      const painel = await screen.findByRole('dialog', { name: 'Filtros do funil' });
      for (const nome of nomes) {
        await userEvent.click(within(within(painel).getByRole('group', { name: 'Tarefas' })).getByRole('button', { name: nome }));
      }
      await userEvent.click(within(painel).getByRole('button', { name: 'Filtrar' }));
    };

    await filtrarCom('Vence hoje');
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.queryByText('João Lima')).toBeNull();

    // O painel começa do que está valendo: desliga "Vence hoje" e liga "Atrasadas".
    await filtrarCom('Vence hoje', 'Atrasadas');
    expect(screen.getByText('João Lima')).toBeInTheDocument();
    expect(screen.queryByText('Maria Souza')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Filtros do funil' })).getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('João Lima')).toBeInTheDocument();
  });

  it('na visão padrão o card ganho aparece na sua coluna', async () => {
    montar();
    expect(await screen.findByText('Paula Reis')).toBeInTheDocument();
    expect(within(document.getElementById('etapa-s2')!).getByText('Paula Reis')).toBeInTheDocument();
  });

  it('a busca também acha pelo email', async () => {
    montar();
    await screen.findByText('Maria Souza');
    await userEvent.type(screen.getByPlaceholderText(BUSCA), 'i1@exemplo');
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.queryByText('João Lima')).toBeNull();
  });

  it('o botão WhatsApp do card abre a conversa daquele lead', async () => {
    montar();
    await screen.findByText('Maria Souza');
    await userEvent.click(within(cardDe('Maria Souza')).getByRole('button', { name: 'Abrir conversa no WhatsApp' }));
    expect(mocks.abrirConversa).toHaveBeenCalledTimes(1);
    expect(mocks.abrirConversa).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }));
  });

  it('se o funil não carrega: avisa com a mensagem de erro, sem cards e sem botão de tentar de novo', async () => {
    vi.mocked(pipelinesService.getPipeline).mockRejectedValue(new Error('falhou'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    montar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('kanban.messages.loadDataError'));
    await esvaziar();
    expect(screen.queryByText('Maria Souza')).toBeNull();
    expect(screen.queryByRole('button', { name: /tentar de novo|recarregar/i })).toBeNull();
  });

  it('a busca digitada não mexe no endereço (o endereço continua só com o que já tinha)', async () => {
    montar('/pipelines/p1?etapa=s2');
    await screen.findByText('Maria Souza');
    await userEvent.type(screen.getByPlaceholderText(BUSCA), 'maria');
    expect(screen.getByTestId('endereco').textContent).not.toContain('maria');
    expect(endereco().has('maria')).toBe(false);
  });
});

describe('quadro do funil · filtros', () => {
  it('filtro no endereço (F5 ou link mandado) já abre filtrado', async () => {
    montar('/pipelines/p1?etapas=s2');
    expect(await screen.findByText('João Lima')).toBeInTheDocument();
    expect(screen.queryByText('Maria Souza')).toBeNull();
  });

  it('Filtros abre o painel à direita, e Filtrar grava no endereço', async () => {
    montar();
    await screen.findByText('Maria Souza');
    await userEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
    const painel = await screen.findByRole('dialog', { name: 'Filtros do funil' });
    await userEvent.click(within(within(painel).getByRole('group', { name: 'Etapas' })).getByRole('button', { name: 'Novo' }));
    await userEvent.click(within(painel).getByRole('button', { name: 'Filtrar' }));
    expect(endereco().getAll('etapas')).toEqual(['s1']);
    expect(screen.queryByText('João Lima')).toBeNull();
    expect(screen.getByRole('button', { name: /^Filtros · 1/ })).toBeInTheDocument();
  });
});

describe('quadro do funil · topo', () => {
  it('três faixas, sem contagem de etapas, valor total nem Importar', async () => {
    montar();
    await screen.findByText('Maria Souza');
    expect(screen.getByRole('button', { name: 'Leads (Marketing)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Abertos 2' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Arquivados' })).toHaveTextContent('1');
    expect(screen.getByText('3 leads')).toBeInTheDocument();
    expect(screen.queryByText('kanban.header.stages')).toBeNull();
    expect(screen.queryByRole('button', { name: /Importar/ })).toBeNull();
  });

  it('a caixa de Arquivados vai para a aba (no endereço)', async () => {
    montar();
    await screen.findByText('Maria Souza');
    await userEvent.click(screen.getByRole('button', { name: 'Arquivados' }));
    expect(endereco().get('aba')).toBe('arquivados');
  });

  it('trocar de aba muda o endereço e mantém o ?card=', async () => {
    montar('/pipelines/p1?card=i1');
    await screen.findByText('Maria Souza');
    await userEvent.click(screen.getByRole('tab', { name: 'Ganhos 1' }));
    expect(endereco().get('aba')).toBe('ganhos');
    expect(endereco().get('card')).toBe('i1');
  });
});
