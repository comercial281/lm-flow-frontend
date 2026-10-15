// src/pages/Customer/Pipelines/PipelineKanban.spec.tsx
// Quadro do funil montado de verdade, com os serviços falsos. Começou (P3-T10)
// como caracterização: o que a divisão do PipelineKanban não pode mudar.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { pipelinesService } from '@/services/pipelines';
import type { Pipeline, PipelineItem, PipelineStage } from '@/types/analytics';
import PipelineKanban from './PipelineKanban';
import { simularCelular } from '@/test/telaDeCelular';

const mocks = vi.hoisted(() => ({ abrirConversa: vi.fn(), fetchLabels: vi.fn(), getPipelineItem: vi.fn() }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn() } }));
vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (chave: string, reserva?: unknown) => (typeof reserva === 'string' ? reserva : chave) }),
}));
// As janelas do quadro são lazy: no teste, nenhuma monta — exceto a janela do
// card (a única que recebe onItemStatusChanged), que aqui é um botão que marca
// Ganho como o rodapé de verdade faria.
// A janela "Adicionar Lead ao Funil" (a única que recebe onItemAdded) vira um
// botão que avisa o quadro que o lead entrou, como a de verdade faz depois do
// aviso dela.
vi.mock('@/utils/chunkReload', () => ({
  lazyWithRetry: () => (p: { item?: Record<string, unknown>; onItemStatusChanged?: (i: unknown) => void; onItemAdded?: () => void; onOpenChange?: (o: boolean) => void; open?: boolean }) =>
    p.open && p.onItemAdded ? (
      <button type="button" onClick={() => p.onItemAdded?.()}>
        Lead adicionado (janela falsa)
      </button>
    ) : p.open !== false && p.onItemStatusChanged && p.item ? (
      <>
        <span>{`situação na janela: ${String(p.item.status ?? 'open')}`}</span>
        <button type="button" onClick={() => p.onOpenChange?.(false)}>
          Fechar (janela falsa)
        </button>
        <button
          type="button"
          onClick={() => p.onItemStatusChanged?.({ ...p.item, status: 'won', won_at: '2026-10-07T12:00:00Z' })}
        >
          Marcar ganho (janela falsa)
        </button>
        {/* O servidor leva o card ganho para Concluído (ajuste de 08/10). */}
        <button
          type="button"
          onClick={() =>
            p.onItemStatusChanged?.({ ...p.item, status: 'won', stage_id: 's9', pipeline_stage_id: 's9' })
          }
        >
          Ganho em Concluído (janela falsa)
        </button>
      </>
    ) : null,
}));
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
  // Sem o dedupe: cada carga da aba Abertos vai direto ao serviço (simulado),
  // com o 1º lote de 30 por coluna.
  loadOpenPipeline: async (id: string) =>
    (await import('@/services/pipelines')).pipelinesService.getBoard(id, { status: 'open' }, 30),
}));
vi.mock('@/services/listOptions/listOptionsService', () => ({ listOptionsService: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/services/pipelines', () => ({
  pipelinesService: {
    getPipelineItem: mocks.getPipelineItem,
    getPipeline: vi.fn(),
    getBoard: vi.fn(),
    getBoardItems: vi.fn(),
    getBoardFacets: vi.fn(),
    getPipelines: vi.fn(),
    reorderItem: vi.fn(),
    archiveItem: vi.fn(),
    unarchiveItem: vi.fn(),
    setItemStatus: vi.fn(),
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

const MARIA = card('i1', 'Maria Souza', 's1');
const JOAO = card('i2', 'João Lima', 's2');
const PAULA = card('i3', 'Paula Reis', 's2', { status: 'won', won_at: '2026-10-06T15:00:00Z' });
const RUI = card('i4', 'Rui Alves', 's1', { status: 'lost', lost_at: '2026-10-05T15:00:00Z', lost_reason: { id: 'm1', label: 'Adiou a compra' } });
const LIA = card('i5', 'Lia Prado', 's1', { archived_at: '2026-10-05T15:00:00Z' });

// Ids que o servidor falso já arquivou / desarquivou (o recarregamento em
// silêncio depois da ação precisa enxergar o que ela gravou).
const arquivadosAgora = new Set<string>();
const desarquivadosAgora = new Set<string>();

// O servidor de verdade filtra por ?status= (P3-T8); aqui a fixture faz igual.
const FUNIL = (status: string = 'open'): Pipeline => {
  const ativos = [MARIA, JOAO, PAULA, RUI].filter(c => !arquivadosAgora.has(String(c.id)));
  const arquivados = [LIA].filter(c => !desarquivadosAgora.has(String(c.id)));
  const da = status === 'archived' ? arquivados : status === 'all' ? ativos : ativos.filter(c => c.status === status);
  return {
    id: 'p1',
    name: 'Leads (Marketing)',
    pipeline_type: 'sale',
    visibility: 'public',
    is_active: true,
    created_at: '2026-10-01',
    updated_at: '2026-10-01',
    status_counts: { open: 2, won: 1, lost: 1, all: 4, archived: 1 },
    stages: [
      etapa('s1', 'Novo', da.filter(c => c.stage_id === 's1')),
      etapa('s2', 'Proposta', da.filter(c => c.stage_id === 's2')),
      // A coluna do Ganho (ajuste de 08/10): tipo Concluída.
      { ...etapa('s9', 'Concluído', da.filter(c => c.stage_id === 's9')), position: 9, stage_type: 'completed' } as PipelineStage,
    ],
  } as unknown as Pipeline;
};

// O quadro em lotes: o servidor manda o total de cada coluna (items_total).
const comTotais = (p: Pipeline): Pipeline =>
  ({ ...p, stages: (p.stages ?? []).map(s => ({ ...s, items_total: s.items?.length ?? 0 })) }) as Pipeline;

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
// Arquiva pelo ⋯ do card, como a pessoa faz.
const arquivarPeloMenu = async (nome: string) => {
  await userEvent.click(within(cardDe(nome)).getByRole('button', { name: 'Mais ações' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Arquivar' }));
};
// O servidor de verdade filtra por etapa (PipelineItems::BoardQuery); aqui a fixture faz igual.
const servidorQueFiltraEtapas = () =>
  vi.mocked(pipelinesService.getBoard).mockImplementation(async (_id, params) => {
    const f = comTotais(FUNIL(params.status as string));
    const etapas = (params.etapas as string[] | undefined) ?? [];
    if (!etapas.length) return f;
    return { ...f, stages: f.stages!.map(st => (etapas.includes(String(st.id)) ? st : { ...st, items: [], items_total: 0 })) } as Pipeline;
  });

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  mocks.getPipelineItem.mockReset().mockRejectedValue(Object.assign(new Error('404'), { response: { status: 404 } }));
  arquivadosAgora.clear();
  desarquivadosAgora.clear();
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
  // O auto-rolar do arraste pergunta qual elemento está sob o cursor; o jsdom não sabe.
  document.elementFromPoint = (() => null) as typeof document.elementFromPoint;
  vi.mocked(pipelinesService.getPipelines).mockResolvedValue({ data: [] } as never);
  vi.mocked(pipelinesService.getPipeline).mockImplementation(async (_id, opts) => FUNIL(opts?.status));
  vi.mocked(pipelinesService.getBoard).mockImplementation(async (_id, params) => comTotais(FUNIL(params.status as string)));
  vi.mocked(pipelinesService.getBoardFacets).mockResolvedValue({ origins: [], assignees: [], unassigned: false });
  vi.mocked(pipelinesService.reorderItem).mockResolvedValue({ success: true, message: '' });
  vi.mocked(pipelinesService.setItemStatus).mockImplementation(async (_p, id) => ({ ...MARIA, id, status: 'won', stage_id: 's9', pipeline_stage_id: 's9' }) as PipelineItem);
  vi.mocked(pipelinesService.archiveItem).mockImplementation(async (_p, id) => { arquivadosAgora.add(String(id)); return {} as PipelineItem; });
  vi.mocked(pipelinesService.unarchiveItem).mockImplementation(async (_p, id) => { desarquivadosAgora.add(String(id)); return {} as PipelineItem; });
});

describe('quadro do funil · o que continua igual', () => {
  it('desenha as colunas e os cards de cada uma', async () => {
    montar();
    expect(await screen.findByText('Maria Souza')).toBeInTheDocument();
    expect(within(document.getElementById('etapa-s1')!).getByText('Novo')).toBeInTheDocument();
    expect(within(document.getElementById('etapa-s2')!).getByText('João Lima')).toBeInTheDocument();
  });

  it('lead adicionado pela janela "Adicionar Lead ao Funil": o quadro recarrega sem um segundo aviso', async () => {
    montar();
    await screen.findByText('Maria Souza');
    await userEvent.click(screen.getByTitle('Adicionar lead'));
    const chamadasAntes = vi.mocked(pipelinesService.getBoard).mock.calls.length;
    await userEvent.click(await screen.findByText('Lead adicionado (janela falsa)'));
    await waitFor(() => expect(vi.mocked(pipelinesService.getBoard).mock.calls.length).toBeGreaterThan(chamadasAntes));
    await esvaziar();
    // O aviso é da janela ("Lead criado e adicionado ao funil."); o quadro não repete.
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('a busca vai pro servidor e o quadro mostra o que ele devolveu', async () => {
    montar();
    await screen.findByText('Maria Souza');
    vi.mocked(pipelinesService.getBoard).mockImplementation(async (_id, params) =>
      comTotais({ ...FUNIL('open'), stages: FUNIL('open').stages!.map(s => ({ ...s, items: (s.items ?? []).filter(i => params.q !== 'maria' || i.id === 'i1') })) }));
    fireEvent.change(screen.getByPlaceholderText(BUSCA), { target: { value: 'maria' } });
    await waitFor(() => expect(pipelinesService.getBoard).toHaveBeenLastCalledWith('p1', expect.objectContaining({ q: 'maria' }), 30));
    await waitFor(() => expect(screen.queryByText('João Lima')).toBeNull());
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
  });

  it('o número da coluna é o total do servidor, não os cards carregados', async () => {
    vi.mocked(pipelinesService.getBoard).mockImplementation(async () => {
      const p = comTotais(FUNIL('open'));
      return { ...p, stages: p.stages!.map(s => (s.id === 's1' ? { ...s, items_total: 412 } : s)) } as Pipeline;
    });
    montar();
    await screen.findByText('Maria Souza');
    expect(within(document.getElementById('etapa-s1')!).getByText('412')).toBeInTheDocument();
  });

  it('arquivar tira o card e desconta 1 do número da coluna na hora', async () => {
    vi.mocked(pipelinesService.getBoard).mockImplementation(async () => {
      const p = comTotais(FUNIL('open'));
      return { ...p, stages: p.stages!.map(s => (s.id === 's1' ? { ...s, items_total: 50 } : s)) } as Pipeline;
    });
    montar();
    await screen.findByText('Maria Souza');
    // segura a recarga por trás pra ver o número local
    vi.mocked(pipelinesService.getBoard).mockImplementation(() => new Promise(() => {}));
    await arquivarPeloMenu('Maria Souza');
    expect(within(document.getElementById('etapa-s1')!).getByText('49')).toBeInTheDocument();
  });

  // Depende da F4 (rolar a coluna carrega mais). Na F4 vira `it`, com este corpo:
  //   const muitos = Array.from({ length: 45 }, (_, n) => card(`x${n}`, `Lead ${n}`, 's1'));
  //   vi.mocked(pipelinesService.getBoard).mockImplementation(async (_id, _p, n) => ({
  //     ...comTotais(FUNIL('open')),
  //     stages: [{ ...etapa('s1', 'Novo', muitos.slice(0, n as number)), items_total: 45 }],
  //   }) as unknown as Pipeline);
  //   vi.mocked(pipelinesService.getBoardItems).mockResolvedValue({ items: muitos.slice(30), total: 45, has_more: false });
  //   montar();
  //   await screen.findByText('Lead 0');
  //   fireEvent.scroll(colunaDe('s1'));
  //   await screen.findByText('Lead 44');
  //   act(() => { window.dispatchEvent(new Event('focus')); });
  //   await waitFor(() => expect(pipelinesService.getBoard).toHaveBeenLastCalledWith('p1', expect.anything(), 45));
  //   expect(screen.getByText('Lead 44')).toBeInTheDocument();
  it.todo('a recarga por trás relê até onde a pessoa rolou');

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

  it('arrastar card que outra guia fechou: volta e mostra a frase do servidor', async () => {
    vi.mocked(pipelinesService.reorderItem).mockRejectedValueOnce({
      response: { data: { success: false, error: { code: 'BUSINESS_RULE_VIOLATION', message: 'Lead fechado não muda de etapa. Reabra para mexer.' } } },
    });
    const calar = vi.spyOn(console, 'error').mockImplementation(() => {});
    montar();
    await screen.findByText('Maria Souza');
    fireEvent.dragStart(cardDe('Maria Souza'));
    fireEvent.dragOver(colunaDe('s2'));
    fireEvent.drop(colunaDe('s2'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Lead fechado não muda de etapa. Reabra para mexer.'));
    expect(within(document.getElementById('etapa-s2')!).queryByText('Maria Souza')).toBeNull();
    calar.mockRestore();
  });

  it('card ganho não arrasta: reabre antes (E2)', async () => {
    montar('/pipelines/p1?aba=todos');
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
    await userEvent.click(screen.getByRole('button', { name: 'Ver em lista' }));
    expect(document.getElementById('etapa-s1')).toBeNull();
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getAllByText('Proposta').length).toBeGreaterThan(0);
  });

  it('arquivar pelo menu do card tira o card do quadro', async () => {
    montar();
    await screen.findByText('Maria Souza');
    await arquivarPeloMenu('Maria Souza');
    await waitFor(() => expect(pipelinesService.archiveItem).toHaveBeenCalledWith('p1', 'i1'));
    expect(screen.queryByText('Maria Souza')).toBeNull();
    // Os números das abas se refazem em silêncio, pedindo a aba que está aberta.
    await waitFor(() => expect(pipelinesService.getBoard).toHaveBeenCalledTimes(2));
    expect(pipelinesService.getBoard).toHaveBeenLastCalledWith('p1', expect.objectContaining({ status: 'open' }), 30);
  });

  it('filtro de Tarefas no endereço vai pro servidor', async () => {
    montar('/pipelines/p1?tarefas=hoje');
    await waitFor(() => expect(pipelinesService.getBoard).toHaveBeenCalledWith('p1', expect.objectContaining({ tarefas: ['hoje'] }), 30));
  });

  it('em Todos o card ganho aparece na sua coluna', async () => {
    montar('/pipelines/p1?aba=todos');
    expect(await screen.findByText('Paula Reis')).toBeInTheDocument();
    expect(within(document.getElementById('etapa-s2')!).getByText('Paula Reis')).toBeInTheDocument();
  });

  it('o botão WhatsApp do card abre a conversa daquele lead', async () => {
    montar();
    await screen.findByText('Maria Souza');
    await userEvent.click(within(cardDe('Maria Souza')).getByRole('button', { name: 'Abrir conversa no WhatsApp' }));
    expect(mocks.abrirConversa).toHaveBeenCalledTimes(1);
    expect(mocks.abrirConversa).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }));
  });

  it('se o funil não carrega: avisa com a mensagem de erro, sem cards e sem botão de tentar de novo', async () => {
    vi.mocked(pipelinesService.getBoard).mockRejectedValue(new Error('falhou'));
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
  it('filtro no endereço (F5 ou link mandado) já abre filtrado, pedindo ao servidor', async () => {
    servidorQueFiltraEtapas();
    montar('/pipelines/p1?etapas=s2');
    expect(await screen.findByText('João Lima')).toBeInTheDocument();
    expect(pipelinesService.getBoard).toHaveBeenCalledWith('p1', expect.objectContaining({ etapas: ['s2'] }), 30);
    expect(screen.queryByText('Maria Souza')).toBeNull();
  });

  it('Filtros abre o painel à direita, e Filtrar grava no endereço e pede ao servidor', async () => {
    servidorQueFiltraEtapas();
    montar();
    await screen.findByText('Maria Souza');
    await userEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
    const painel = await screen.findByRole('dialog', { name: 'Filtros do funil' });
    await userEvent.click(within(within(painel).getByRole('group', { name: 'Etapas' })).getByRole('button', { name: 'Novo' }));
    await userEvent.click(within(painel).getByRole('button', { name: 'Filtrar' }));
    expect(endereco().getAll('etapas')).toEqual(['s1']);
    await waitFor(() => expect(pipelinesService.getBoard).toHaveBeenLastCalledWith('p1', expect.objectContaining({ etapas: ['s1'] }), 30));
    await waitFor(() => expect(screen.queryByText('João Lima')).toBeNull());
    expect(screen.getByRole('button', { name: /^Filtros · 1/ })).toBeInTheDocument();
  });
});

describe('quadro do funil · topo', () => {
  it('três faixas, sem contagem de etapas, valor total nem Importar', async () => {
    montar();
    await screen.findByText('Maria Souza');
    expect(screen.getByRole('button', { name: 'Leads (Marketing)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Abertos 2' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /^Arquivados/ })).toHaveTextContent('1');
    expect(screen.getByText('2 leads')).toBeInTheDocument();
    expect(screen.queryByText('kanban.header.stages')).toBeNull();
    expect(screen.queryByRole('button', { name: /Importar/ })).toBeNull();
  });

  it('a caixa de Arquivados vai para a aba (no endereço)', async () => {
    montar();
    await screen.findByText('Maria Souza');
    await userEvent.click(screen.getByRole('button', { name: /^Arquivados/ }));
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

describe('quadro do funil · abas', () => {
  it('cada aba pede ao servidor só os cards dela', async () => {
    montar();
    expect(await screen.findByText('Maria Souza')).toBeInTheDocument();
    expect(pipelinesService.getBoard).toHaveBeenCalledWith('p1', expect.objectContaining({ status: 'open' }), 30);
    expect(screen.queryByText('Paula Reis')).toBeNull();

    await userEvent.click(screen.getByRole('tab', { name: 'Ganhos 1' }));
    expect(await screen.findByText('Paula Reis')).toBeInTheDocument();
    expect(pipelinesService.getBoard).toHaveBeenLastCalledWith('p1', expect.objectContaining({ status: 'won' }), 30);
    expect(screen.queryByText('Maria Souza')).toBeNull();
  });

  // Review Focus 1.
  it('Ganhos e Perdidos não arrastam (nem pelo atributo, nem pelo handler)', async () => {
    montar('/pipelines/p1?aba=perdidos');
    await screen.findByText('Rui Alves');
    expect(cardDe('Rui Alves')).toHaveAttribute('draggable', 'false');
    fireEvent.dragStart(cardDe('Rui Alves'));
    fireEvent.dragOver(colunaDe('s2'));
    fireEvent.drop(colunaDe('s2'));
    expect(pipelinesService.reorderItem).not.toHaveBeenCalled();
  });

  it('em Todos só o card aberto arrasta', async () => {
    montar('/pipelines/p1?aba=todos');
    await screen.findByText('Paula Reis');
    expect(cardDe('Paula Reis')).toHaveAttribute('draggable', 'false');
    expect(cardDe('Maria Souza')).toHaveAttribute('draggable', 'true');
    fireEvent.dragStart(cardDe('Maria Souza'));
    fireEvent.dragOver(colunaDe('s2'));
    fireEvent.drop(colunaDe('s2'));
    await waitFor(() =>
      expect(pipelinesService.reorderItem).toHaveBeenCalledWith('p1', 'i1', expect.objectContaining({ new_stage_id: 's2' })),
    );
  });

  it('Arquivados: o card na coluna dele, com Desarquivar, e não arrasta', async () => {
    montar('/pipelines/p1?aba=arquivados');
    expect(await screen.findByText('Lia Prado')).toBeInTheDocument();
    expect(within(document.getElementById('etapa-s1')!).getByText('Lia Prado')).toBeInTheDocument();
    expect(cardDe('Lia Prado')).toHaveAttribute('draggable', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Desarquivar' }));
    await waitFor(() => expect(pipelinesService.unarchiveItem).toHaveBeenCalledWith('p1', 'i5'));
    expect(screen.queryByText('Lia Prado')).toBeNull();
    await waitFor(() => expect(pipelinesService.getBoard).toHaveBeenLastCalledWith('p1', expect.objectContaining({ status: 'archived' }), 30));
  });

  // Review Focus 5.
  it('F5 numa aba: a aba e o card continuam no endereço', async () => {
    montar('/pipelines/p1?aba=perdidos&card=i4');
    await screen.findByText('Rui Alves');
    expect(pipelinesService.getBoard).toHaveBeenCalledWith('p1', expect.objectContaining({ status: 'lost' }), 30);
    expect(endereco().get('aba')).toBe('perdidos');
    expect(endereco().get('card')).toBe('i4');
    expect(screen.queryByText('Este lead não está nesta aba.')).toBeNull();
  });

  it('janela aberta e o card ganho em outra guia: a volta do foco atualiza a janela', async () => {
    montar('/pipelines/p1?aba=todos&card=i1');
    expect(await screen.findByText('situação na janela: open')).toBeInTheDocument();

    vi.mocked(pipelinesService.getBoard).mockImplementation(async () => {
      const f = comTotais(FUNIL('all'));
      return {
        ...f,
        stages: f.stages!.map(s => ({
          ...s,
          items: (s.items || []).map(i => (i.id === 'i1' ? { ...i, status: 'won', won_at: '2026-10-08T09:00:00Z' } : i)),
        })),
      } as Pipeline;
    });
    act(() => { window.dispatchEvent(new Event('focus')); });

    expect(await screen.findByText('situação na janela: won')).toBeInTheDocument();
  });

  it('link de card que não está nesta aba: busca o card pelo id e abre, sem aviso', async () => {
    mocks.getPipelineItem.mockResolvedValue({
      item: MARIA,
      stage_durations: [],
      pipeline: { id: 'p1', name: 'Leads (Marketing)', stages: [] },
    });
    montar('/pipelines/p1?aba=ganhos&card=i1');

    expect(await screen.findByText('Paula Reis')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Marcar ganho (janela falsa)' })).toBeInTheDocument();
    await waitFor(() => expect(mocks.getPipelineItem).toHaveBeenCalledWith('p1', 'i1'));
    expect(endereco().get('card')).toBe('i1');
    expect(screen.queryByText('Você não tem acesso a este lead')).toBeNull();
    expect(screen.queryByText('Este lead não está nesta aba.')).toBeNull();
  });

  it('fechar a janela de um card FORA da aba: busca uma vez só, a janela fica fechada e o card sai do endereço', async () => {
    mocks.getPipelineItem.mockResolvedValue({
      item: MARIA,
      stage_durations: [],
      pipeline: { id: 'p1', name: 'Leads (Marketing)', stages: [] },
    });
    montar('/pipelines/p1?aba=ganhos&card=i1');
    await userEvent.click(await screen.findByRole('button', { name: 'Fechar (janela falsa)' }));

    await waitFor(() => expect(endereco().get('card')).toBeNull());
    await new Promise(r => setTimeout(r, 20));
    expect(screen.queryByRole('button', { name: 'Fechar (janela falsa)' })).toBeNull();
    expect(mocks.getPipelineItem).toHaveBeenCalledTimes(1);
  });

  it('fechar a janela de um card que ESTÁ na aba: a janela não reabre', async () => {
    montar('/pipelines/p1?card=i1');
    await userEvent.click(await screen.findByRole('button', { name: 'Fechar (janela falsa)' }));

    await waitFor(() => expect(endereco().get('card')).toBeNull());
    await new Promise(r => setTimeout(r, 20));
    expect(screen.queryByRole('button', { name: 'Fechar (janela falsa)' })).toBeNull();
    expect(mocks.getPipelineItem).not.toHaveBeenCalled();
  });

  it('link de card sem acesso (outro corretor, apagado): avisa, e o X tira o card do endereço', async () => {
    montar('/pipelines/p1?card=zz');

    expect(await screen.findByText('Você não tem acesso a este lead')).toBeInTheDocument();
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    expect(endereco().get('card')).toBeNull();
    expect(screen.queryByText('Você não tem acesso a este lead')).toBeNull();
  });

  it('resposta atrasada de outra aba não toma o lugar da aba aberta', async () => {
    let soltarPerdidos: (p: Pipeline) => void = () => {};
    vi.mocked(pipelinesService.getBoard).mockImplementation(async (_id, params) =>
      params.status === 'lost' ? new Promise<Pipeline>(r => { soltarPerdidos = r; }) : comTotais(FUNIL(params.status as string)),
    );
    montar();
    await screen.findByText('Maria Souza');
    await userEvent.click(screen.getByRole('tab', { name: 'Perdidos 1' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Ganhos 1' }));
    expect(await screen.findByText('Paula Reis')).toBeInTheDocument();

    soltarPerdidos(comTotais(FUNIL('lost')));
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByText('Rui Alves')).toBeNull();
    expect(screen.getByText('Paula Reis')).toBeInTheDocument();
  });

  it('aba que não carregou: erro com "Tentar de novo", nunca os cards da aba anterior', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(pipelinesService.getBoard).mockImplementation(async (_id, params) => {
      if (params.status === 'lost') throw new Error('falhou');
      return comTotais(FUNIL(params.status as string));
    });
    montar();
    await screen.findByText('Maria Souza');
    await userEvent.click(screen.getByRole('tab', { name: 'Perdidos 1' }));
    const tentar = await screen.findByRole('button', { name: 'Tentar de novo' });
    expect(screen.queryByText('Maria Souza')).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('kanban.messages.loadDataError');

    vi.mocked(pipelinesService.getBoard).mockImplementation(async (_id, params) => comTotais(FUNIL(params.status as string)));
    await userEvent.click(tentar);
    expect(await screen.findByText('Rui Alves')).toBeInTheDocument();
    expect(pipelinesService.getBoard).toHaveBeenLastCalledWith('p1', expect.objectContaining({ status: 'lost' }), 30);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
  });

  it('"Adicionar etapa" só aparece em Abertos', async () => {
    montar('/pipelines/p1?aba=ganhos');
    await screen.findByText('Paula Reis');
    expect(screen.queryByText('kanban.stage.addStage')).toBeNull();
  });

  // Review Focus 5: o card que acabou de sair da aba com a janela aberta.
  it('marcar Ganho em Abertos com a janela aberta: o card sai da aba e o aviso NÃO aparece', async () => {
    // Depois de gravar, o servidor já não manda a Maria em Abertos (o recarregamento
    // em silêncio do handleItemStatusChanged). A 1ª carga ainda é a de antes de marcar.
    vi.mocked(pipelinesService.getBoard).mockImplementation(async (_id, params) => {
      const funil = comTotais(FUNIL(params.status as string));
      if ((params.status ?? 'open') !== 'open') return funil;
      return { ...funil, stages: funil.stages!.map(st => ({ ...st, items: (st.items || []).filter(i => i.id !== 'i1') })) };
    });
    vi.mocked(pipelinesService.getBoard).mockImplementationOnce(async () => comTotais(FUNIL('open')));
    montar('/pipelines/p1?card=i1');
    // A janela abre pelo ?card= e o botão falso aparece.
    const botao = await screen.findByRole('button', { name: 'Marcar ganho (janela falsa)' });
    // Segura a resposta do recarregamento: a saída do card tem que ser local e imediata.
    let soltar: (p: Pipeline) => void = () => {};
    vi.mocked(pipelinesService.getBoard).mockImplementationOnce(() => new Promise<Pipeline>(r => { soltar = r; }));
    await userEvent.click(botao);
    expect(within(document.getElementById('etapa-s1')!).queryByText('Maria Souza')).toBeNull();
    expect(pipelinesService.getBoard).toHaveBeenCalledTimes(2);
    expect(pipelinesService.getBoard).toHaveBeenLastCalledWith('p1', expect.objectContaining({ status: 'open' }), 30);
    soltar(comTotais(FUNIL('open')));

    await waitFor(() => expect(within(document.getElementById('etapa-s1')!).queryByText('Maria Souza')).toBeNull());
    expect(screen.queryByText('Este lead não está nesta aba.')).toBeNull();
    expect(endereco().get('card')).toBe('i1');
    expect(mocks.getPipelineItem).not.toHaveBeenCalled();
  });
});

describe('quadro do funil · soltar em Concluído é Ganho (ajuste de 08/10)', () => {
  it('em Abertos: chama a rota da situação (não o reorder), o card sai da aba e os números se refazem', async () => {
    // Depois de gravar, o servidor já não manda a Maria em Abertos.
    vi.mocked(pipelinesService.getBoard).mockImplementation(async (_id, params) => {
      const funil = comTotais(FUNIL(params.status as string));
      if ((params.status ?? 'open') !== 'open') return funil;
      return { ...funil, stages: funil.stages!.map(st => ({ ...st, items: (st.items || []).filter(i => i.id !== 'i1') })) };
    });
    vi.mocked(pipelinesService.getBoard).mockImplementationOnce(async () => comTotais(FUNIL('open')));
    montar();
    await screen.findByText('Maria Souza');

    fireEvent.dragStart(cardDe('Maria Souza'));
    fireEvent.dragOver(colunaDe('s9'));
    fireEvent.drop(colunaDe('s9'));

    await waitFor(() => expect(pipelinesService.setItemStatus).toHaveBeenCalledWith('p1', 'i1', { status: 'won' }));
    expect(pipelinesService.reorderItem).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Maria Souza')).toBeNull());
    await waitFor(() => expect(pipelinesService.getBoard).toHaveBeenCalledTimes(2));
  });

  it('recusa do servidor: o card volta para a coluna dele e a frase aparece', async () => {
    const { toast } = await import('sonner');
    vi.mocked(pipelinesService.setItemStatus).mockRejectedValue({
      response: { status: 422, data: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Este card está arquivado. Desarquive antes de mudar a situação.' } } },
    });
    montar();
    await screen.findByText('Maria Souza');

    fireEvent.dragStart(cardDe('Maria Souza'));
    fireEvent.dragOver(colunaDe('s9'));
    fireEvent.drop(colunaDe('s9'));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Este card está arquivado. Desarquive antes de mudar a situação.'),
    );
    expect(within(document.getElementById('etapa-s1')!).getByText('Maria Souza')).toBeInTheDocument();
  });

  it('em Todos: o Ganho pela janela que trouxe o card para Concluído troca a coluna dele no quadro', async () => {
    // Depois de gravar, o servidor manda a Maria ganha em Concluído (o recarregamento em silêncio).
    vi.mocked(pipelinesService.getBoard).mockImplementation(async (_id, params) => {
      const funil = comTotais(FUNIL(params.status as string));
      const ganha = { ...MARIA, status: 'won', stage_id: 's9', pipeline_stage_id: 's9' } as PipelineItem;
      return {
        ...funil,
        stages: funil.stages!.map(st => ({
          ...st,
          items: st.id === 's9' ? [ganha] : (st.items || []).filter(i => i.id !== 'i1'),
        })),
      };
    });
    vi.mocked(pipelinesService.getBoard).mockImplementationOnce(async (_id, params) => comTotais(FUNIL(params.status as string)));
    montar('/pipelines/p1?aba=todos&card=i1');

    await userEvent.click(await screen.findByRole('button', { name: 'Ganho em Concluído (janela falsa)' }));

    await waitFor(() =>
      expect(within(document.getElementById('etapa-s9')!).getByText('Maria Souza')).toBeInTheDocument(),
    );
    expect(within(document.getElementById('etapa-s1')!).queryByText('Maria Souza')).toBeNull();
  });
});

describe('quadro do funil · exportar', () => {
  it('Exportar busca todas as situações (não só a aba) e baixa o CSV', async () => {
    const baixar = vi.fn(() => 'blob:csv');
    URL.createObjectURL = baixar as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    montar();
    await screen.findByText('Maria Souza');

    await userEvent.click(screen.getByRole('button', { name: 'Mais ações do funil' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Exportar' }));

    await waitFor(() => expect(pipelinesService.getPipeline).toHaveBeenLastCalledWith('p1', { status: 'all' }));
    await waitFor(() => expect(baixar).toHaveBeenCalledWith(expect.any(Blob)));
    expect(clique).toHaveBeenCalled();
    clique.mockRestore();
  });
});

// Raio-X do celular (10/10/2026): no celular o card abre na PÁGINA, não na janela.
describe('quadro do funil · no celular', () => {
  beforeEach(() => {
    const tela = simularCelular();
    // O BrowserRouter grava `idx` no histórico; o MemoryRouter não. Primeira tela da guia = 0.
    window.history.replaceState(null, '');
    return () => { tela.restaurar(); window.history.replaceState(null, ''); };
  });

  function PaginaDoCard() {
    const l = useLocation();
    const navigate = useNavigate();
    return (
      <>
        <output data-testid="pagina-do-card">{`${l.pathname}|${JSON.stringify(l.state)}`}</output>
        <button type="button" onClick={() => navigate(-1)}>Voltar (página falsa)</button>
      </>
    );
  }
  const montarComPagina = (entradas: string[]) =>
    render(
      <MemoryRouter initialEntries={entradas} initialIndex={entradas.length - 1}>
        <Routes>
          <Route path="/pipelines/:pipelineId" element={<><PipelineKanban /><Endereco /></>} />
          <Route path="/pipelines/:pipelineId/card/:itemId" element={<PaginaDoCard />} />
          <Route path="/tarefas" element={<p>Tela de tarefas</p>} />
        </Routes>
      </MemoryRouter>,
    );

  it('tocar no cartão empilha a página do card (sem a janela) e o voltar devolve ao quadro', async () => {
    montarComPagina(['/pipelines/p1']);
    await screen.findByText('Maria Souza');
    fireEvent.click(cardDe('Maria Souza'));

    expect(await screen.findByTestId('pagina-do-card')).toHaveTextContent('/pipelines/p1/card/i1|{"voltarPeloHistorico":true}');
    expect(screen.queryByText(/situação na janela/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar (página falsa)' }));
    expect(await screen.findByText('Maria Souza')).toBeInTheDocument();
    expect(endereco().get('card')).toBeNull();
  });

  it('?card= vindo de outra tela (Tarefas): troca o endereço pela página e o voltar volta pras Tarefas', async () => {
    window.history.replaceState({ idx: 1 }, '');
    montarComPagina(['/tarefas', '/pipelines/p1?card=i1']);

    expect(await screen.findByTestId('pagina-do-card')).toHaveTextContent('/pipelines/p1/card/i1|{"voltarPeloHistorico":true}');
    expect(screen.queryByText(/situação na janela/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar (página falsa)' }));
    expect(await screen.findByText('Tela de tarefas')).toBeInTheDocument();
  });

  it('?card= de link colado (primeira tela da guia): página sem o voltar pelo histórico', async () => {
    montarComPagina(['/pipelines/p1?card=i1']);
    expect(await screen.findByTestId('pagina-do-card')).toHaveTextContent('/pipelines/p1/card/i1|null');
  });
});

