// src/pages/Customer/Pipelines/quadro/StageColumn.spec.tsx
// Coluna do quadro no Vidro violeta (spec 2026-10-30-vidro-violeta-telas-design.md).
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PipelineStage } from '@/types/analytics';
import StageColumn, { type StageColumnProps } from './StageColumn';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (chave: string, reserva?: unknown) => (typeof reserva === 'string' ? reserva : chave) }),
}));

const etapa = (extra: Record<string, unknown> = {}) =>
  ({ id: 's1', name: 'Atendimento', color: '#3b82f6', items: [], items_total: 0, ...extra }) as unknown as PipelineStage;

function montar(stage: PipelineStage) {
  const props: StageColumnProps = {
    stage, destacada: false, visitsByContact: {},
    isDraggingRef: { current: false }, suppressClickUntilRef: { current: 0 },
    onDragOver: vi.fn(), onDrop: vi.fn(), onCardDragStart: vi.fn(), onCardDragEnd: vi.fn(), onCardDragOver: vi.fn(),
    arrastandoId: null, esqueleto: null, onCardDrop: vi.fn(), onOpenItem: vi.fn(), onArchive: vi.fn(), onRemove: vi.fn(),
    podeArrastar: () => true, arquivado: false, onUnarchive: vi.fn(), onOpenConversation: vi.fn(), openingConversation: false,
    onEditStage: vi.fn(), onDeleteStage: vi.fn(), carregandoMais: false, erroAoCarregarMais: false, onCarregarMais: vi.fn(),
  };
  return render(<StageColumn {...props} />);
}

describe('coluna do quadro no Vidro violeta', () => {
  it('o topo passa a cor da etapa pro fio aceso', () => {
    montar(etapa());
    const topo = screen.getByText('Atendimento').closest('.quadro-coluna-topo') as HTMLElement;
    expect(topo).not.toBeNull();
    expect(topo.style.getPropertyValue('--etapa')).toBe('#3b82f6');
  });

  it('etapa sem cor não define --etapa (o CSS usa o roxo de reserva)', () => {
    montar(etapa({ color: '' }));
    const topo = screen.getByText('Atendimento').closest('.quadro-coluna-topo') as HTMLElement;
    expect(topo.style.getPropertyValue('--etapa')).toBe('');
  });

  it('a coluna continua com 320 px (as setas ‹ › andam 344 px)', () => {
    const { container } = montar(etapa());
    expect(container.querySelector('#etapa-s1')).toHaveClass('w-80');
  });

  it('o nome da etapa usa o rótulo em caixa alta', () => {
    montar(etapa());
    expect(screen.getByText('Atendimento')).toHaveClass('quadro-coluna-nome');
  });
});
