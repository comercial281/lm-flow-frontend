// src/pages/Customer/Pipelines/PipelineItemCard.spec.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PipelineItem } from '@/types/analytics';
import PipelineItemCard from './PipelineItemCard';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (chave: string, reserva?: unknown) => (typeof reserva === 'string' ? reserva : chave) }),
}));

const item = (extra: Record<string, unknown> = {}) =>
  ({
    id: 'i1', pipeline_id: 'p1', stage_id: 's1', status: 'open',
    contact: { id: 'c1', name: 'Maria Souza', phone_number: '+5511999990000', email: 'maria@exemplo.com.br',
      qualification_status: 'hot', labels: [{ name: 'Tráfego pago', color: '#7c3aed' }] },
    primary_property: { id: 'pr1', title: 'Apto Vista Mar' },
    assignee: { id: 'u1', name: 'Ana Paula', avatar_url: '' },
    tasks_info: { pending_count: 0, overdue_count: 1, due_soon_count: 0, completed_count: 0, total_count: 1 },
    services_info: { has_services: true, total_value: 500000, formatted_total: 'R$ 500.000,00' },
    conversation: { id: 'cv1', status: 'open', last_activity_at: Math.floor(Date.now() / 1000) - 10 * 86_400, inbox: { name: 'Plantão' } },
    is_lead: false,
    ...extra,
  }) as unknown as PipelineItem;

function montar(extra: Partial<Parameters<typeof PipelineItemCard>[0]> = {}) {
  const props = {
    item: item(), stageId: 's1', visitsByContact: {}, podeArrastar: true, arquivado: false,
    isDraggingRef: { current: false }, suppressClickUntilRef: { current: 0 },
    onDragStart: vi.fn(), onDragEnd: vi.fn(), onCardDragOver: vi.fn(), onCardDrop: vi.fn(),
    onOpenItem: vi.fn(), onArchive: vi.fn(), onUnarchive: vi.fn(), onRemove: vi.fn(),
    onOpenConversation: vi.fn(), openingConversation: false,
    ...extra,
  };
  render(<PipelineItemCard {...props} />);
  return props;
}

describe('card do quadro mínimo (spec funil §4.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
  });

  it('nome com a setinha que abre o card completo em outra guia (link de verdade)', () => {
    montar();
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    const seta = screen.getByRole('link', { name: 'Abrir o card completo em nova guia' });
    expect(seta).toHaveAttribute('href', '/pipelines/p1/card/i1');
    expect(seta).toHaveAttribute('target', '_blank');
    expect(seta).toHaveAttribute('rel', 'noopener');
  });

  it('sai o que poluía: telefone, e-mail, código, Ligar, Agendar, temperatura, imóvel, etiquetas, caixa de entrada, valor', () => {
    montar();
    for (const texto of ['(11) 99999-0000', 'maria@exemplo.com.br', 'Ligar', 'Agendar', 'Quente', 'Apto Vista Mar', 'Tráfego pago', 'Plantão', 'R$ 500.000,00']) {
      expect(screen.queryByText(texto)).toBeNull();
    }
    expect(screen.queryByText(/^#/)).toBeNull();
  });

  it('um sinal só: com tarefa atrasada e 10 dias sem contato, aparece só a tarefa', () => {
    montar();
    expect(screen.getByText('Tarefa atrasada')).toBeInTheDocument();
    expect(screen.queryByText(/sem contato/)).toBeNull();
  });

  it('selo quando fechado', () => {
    montar({ item: item({ status: 'lost' }) });
    expect(screen.getByText('Perdido')).toHaveAttribute('data-situacao', 'lost');
  });

  it('foto do lead ao lado do nome', () => {
    montar({ item: item({ contact: { id: 'c1', name: 'Maria Souza', avatar_url: 'https://exemplo.com.br/maria.jpg' } }) });
    expect(document.querySelector('img[src="https://exemplo.com.br/maria.jpg"]')).not.toBeNull();
  });

  it('sem foto do lead, aparece a inicial do nome dele', () => {
    montar();
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('embaixo só o nome do responsável, sem a foto dele; WhatsApp abre a conversa sem abrir o card', async () => {
    const { onOpenConversation, onOpenItem } = montar({
      item: item({ assignee: { id: 'u1', name: 'Ana Paula', avatar_url: 'https://exemplo.com.br/ana.jpg' } }),
    });
    expect(screen.getByTitle('Responsável: Ana Paula')).toHaveTextContent('Ana Paula');
    expect(document.querySelector('img[src="https://exemplo.com.br/ana.jpg"]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir conversa no WhatsApp' }));
    expect(onOpenConversation).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }));
    expect(onOpenItem).not.toHaveBeenCalled();
  });

  it('clicar no card abre a janela', async () => {
    const { onOpenItem } = montar();
    await userEvent.click(screen.getByText('Maria Souza'));
    expect(onOpenItem).toHaveBeenCalled();
  });

  it('⋯: Abrir, Abrir em nova guia, Copiar link, Arquivar, Remover do funil (sem Agendar ação nem Ver notas)', async () => {
    const user = userEvent.setup();
    const { onArchive, onRemove } = montar();
    await user.click(screen.getByRole('button', { name: 'Mais ações' }));
    const itens = (await screen.findAllByRole('menuitem')).map(i => i.textContent);
    expect(itens).toEqual(['Abrir', 'Abrir em nova guia', 'Copiar link', 'Arquivar', 'Remover do funil']);
    expect(screen.getByRole('menuitem', { name: 'Abrir em nova guia' })).toHaveAttribute('href', '/pipelines/p1/card/i1');

    await user.click(screen.getByRole('menuitem', { name: 'Copiar link' }));
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/pipelines/p1/card/i1`);

    await user.click(screen.getByRole('button', { name: 'Mais ações' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Arquivar' }));
    expect(onArchive).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Mais ações' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remover do funil' }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('na aba Arquivados: Desarquivar no card e no ⋯', async () => {
    const { onUnarchive } = montar({ arquivado: true, podeArrastar: false });
    await userEvent.click(screen.getByRole('button', { name: 'Desarquivar' }));
    expect(onUnarchive).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    expect(await screen.findByRole('menuitem', { name: 'Desarquivar' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Arquivar' })).toBeNull();
  });

  it('o card só arrasta quando pode (Review Focus 1)', () => {
    const { onDragStart } = montar({ podeArrastar: false });
    const card = screen.getByText('Maria Souza').closest('[draggable]') as HTMLElement;
    expect(card).toHaveAttribute('draggable', 'false');
    fireEvent.dragStart(card);
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('continua memo (o quadro com 2.800 cards depende disso)', () => {
    expect((PipelineItemCard as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.memo'));
  });
});
