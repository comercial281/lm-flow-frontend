import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import type { PipelineItem } from '@/types/analytics';
import { tarefasService } from '@/features/tarefas/tarefasService';
import MiniCardDoLead from './MiniCardDoLead';
import { useMiniCard } from './useMiniCard';

vi.mock('@/features/tarefas/tarefasService', async importOriginal => {
  const real = await importOriginal<typeof import('@/features/tarefas/tarefasService')>();
  return { ...real, tarefasService: { ...real.tarefasService, listar: vi.fn() } };
});

const lead = (extra: Partial<PipelineItem> = {}) =>
  ({
    id: 'i1',
    stage_id: 's1',
    status: 'open',
    days_in_current_stage: 4,
    assignee: { id: 'u1', name: 'Ana' },
    contact: { id: 'c1', name: 'Maria Souza', phone_number: '+5511982353462' },
    tasks_info: { open_tasks: [] },
    ...extra,
  }) as unknown as PipelineItem;

function Quadro({ item }: { item: PipelineItem }) {
  const arrastando = useRef(false);
  const mini = useMiniCard(arrastando);
  return (
    <div id="etapa-s1">
      <div
        data-testid="card"
        onPointerEnter={e => mini.aoPassarMouse('entrou', item, e.currentTarget)}
        onPointerLeave={e => mini.aoPassarMouse('saiu', item, e.currentTarget)}
        onPointerDown={e => mini.aoPassarMouse('apertou', item, e.currentTarget)}
      >
        {item.contact?.name}
      </div>
      <MiniCardDoLead alvo={mini.alvo} nomeDaEtapa="Em atendimento" onEntrar={mini.aoEntrarNoMini} onSair={mini.aoSairDoMini} />
    </div>
  );
}

const resumo = () => screen.queryByRole('region', { name: /Resumo de/ });

describe('mini card do quadro', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(tarefasService.listar).mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('abre depois de 0,8 s com o mouse parado, com telefone, etapa e sem tarefa', () => {
    render(<Quadro item={lead()} />);
    fireEvent.pointerEnter(screen.getByTestId('card'));
    act(() => { vi.advanceTimersByTime(700); });
    expect(resumo()).toBeNull();
    act(() => { vi.advanceTimersByTime(100); });
    expect(resumo()).not.toBeNull();
    expect(screen.getByText('(11) 98235-3462')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    expect(screen.getByText('Nesta etapa há 4 dias')).toBeInTheDocument();
    expect(screen.getByText('Em atendimento')).toBeInTheDocument();
    expect(screen.getByText('Sem tarefa marcada')).toBeInTheDocument();
    expect(tarefasService.listar).not.toHaveBeenCalled();
  });

  it('apertou o card (clique ou arrasto): não abre', () => {
    render(<Quadro item={lead()} />);
    const card = screen.getByTestId('card');
    fireEvent.pointerEnter(card);
    act(() => { vi.advanceTimersByTime(400); });
    fireEvent.pointerDown(card);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(resumo()).toBeNull();
  });

  it('sair do card fecha; Esc também', () => {
    render(<Quadro item={lead()} />);
    const card = screen.getByTestId('card');
    fireEvent.pointerEnter(card);
    act(() => { vi.advanceTimersByTime(800); });
    expect(resumo()).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(resumo()).toBeNull();

    fireEvent.pointerEnter(card);
    act(() => { vi.advanceTimersByTime(800); });
    fireEvent.pointerLeave(card);
    act(() => { vi.advanceTimersByTime(200); });
    expect(resumo()).toBeNull();
  });

  it('lead sem dono em oferta (ofertas ainda chegando): telefone mascarado, sem Copiar', () => {
    render(<Quadro item={lead({ assignee: null } as never)} />);
    fireEvent.pointerEnter(screen.getByTestId('card'));
    act(() => { vi.advanceTimersByTime(800); });
    expect(screen.queryByText('(11) 98235-3462')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copiar' })).toBeNull();
    expect(screen.getByText('O telefone aparece quando você aceitar o lead.')).toBeInTheDocument();
  });

  it('com tarefa aberta, pede o título ao servidor só com o resumo aberto', async () => {
    vi.mocked(tarefasService.listar).mockResolvedValue({ data: [{ title: 'Mandar simulação' }] } as never);
    const due = new Date(Date.now() - 3_600_000).toISOString();
    render(<Quadro item={lead({ id: 'i9', tasks_info: { open_tasks: [{ category_option_id: null, due_at: due }] } } as never)} />);
    fireEvent.pointerEnter(screen.getByTestId('card'));
    expect(tarefasService.listar).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(800); });
    expect(tarefasService.listar).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'para_fazer', kind: 'task', pipeline_item_ids: ['i9'], per_page: 1 }),
    );
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByText(/Mandar simulação · /)).toBeInTheDocument());
    expect(screen.getByText('Atrasada')).toBeInTheDocument();
  });
});
