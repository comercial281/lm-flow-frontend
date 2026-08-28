import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PipelineItemCard from './PipelineItemCard';
import type { PipelineItem } from '@/types/analytics';

const openLeadConversation = vi.fn();

vi.mock('@/hooks/useOpenLeadConversation', () => ({
  useOpenLeadConversation: () => ({
    openLeadConversation,
    startConversationModal: null,
    opening: false,
  }),
}));

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string, fallback?: string) => fallback || key }),
}));

vi.mock('@evoapi/design-system', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>{children}</button>
  ),
  Badge: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <span {...props}>{children}</span>
  ),
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

// ⚠️ AQUI HAVIA UM vi.mock('lucide-react') SUBSTITUINDO O PACOTE INTEIRO POR UMA
// LISTA DE ÍCONES, E ELE CONGELAVA A SUÍTE — o arquivo nunca terminava. Medido:
// sem ele os testes deste arquivo passam em menos de 100ms.
//
// O lucide-react é importado por centenas de módulos do projeto. Trocar o pacote
// inteiro por um punhado de ícones deixa como `undefined` todo ícone que alguém
// no grafo importe e que não esteja na lista — e a lista envelhece sozinha, a
// cada ícone novo que qualquer tela usar.
//
// Ícone de verdade renderiza normalmente em jsdom. Não há o que mockar aqui.

const renderCard = (ui: React.ReactElement) => render(ui, { wrapper: MemoryRouter });

const baseItem = {
  id: 'item-1',
  pipeline_id: 'pipeline-1',
  stage_id: 'stage-1',
  contact: { name: 'João Silva', phone_number: '+5511999999999' },
  entered_at: Date.now() / 1000,
} as unknown as PipelineItem;

describe('PipelineItemCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders menu with mobile-visible responsive classes', () => {
    const { container } = renderCard(
      <PipelineItemCard item={baseItem} onEdit={vi.fn()} showActions />,
    );

    const menuContainer = container.querySelector('.absolute.top-2.right-2');
    expect(menuContainer).toBeTruthy();
    expect(menuContainer?.className).toContain('opacity-100');
    expect(menuContainer?.className).toContain('md:opacity-0');
    expect(menuContainer?.className).toContain('md:group-hover:opacity-100');
  });

  it('calls onView when card body is clicked', () => {
    const onView = vi.fn();

    const { container } = renderCard(
      <PipelineItemCard item={baseItem} onView={onView} />,
    );

    fireEvent.click(container.firstElementChild!);
    expect(onView).toHaveBeenCalledWith(baseItem);
  });

  it('does not call onView when menu area is clicked', () => {
    const onView = vi.fn();

    const { container } = renderCard(
      <PipelineItemCard item={baseItem} onView={onView} onEdit={vi.fn()} showActions />,
    );

    const menuContainer = container.querySelector('.absolute.top-2.right-2');
    fireEvent.click(menuContainer!);
    expect(onView).not.toHaveBeenCalled();
  });

  it('renders contact name', () => {
    renderCard(<PipelineItemCard item={baseItem} />);
    expect(screen.getByText('João Silva')).toBeTruthy();
  });

  // O botão era um <a href="https://wa.me/..."> que tirava o corretor do CRM:
  // a conversa acontecia fora, sem histórico e sem nada do funil.
  it('does not link out to wa.me anymore', () => {
    const { container } = renderCard(<PipelineItemCard item={baseItem} />);

    expect(container.querySelector('a[href^="https://wa.me"]')).toBeNull();
  });

  it('opens the conversation inside the CRM when WhatsApp is clicked', () => {
    const onView = vi.fn();
    renderCard(<PipelineItemCard item={baseItem} onView={onView} />);

    fireEvent.click(screen.getByTitle('Abrir conversa'));

    expect(openLeadConversation).toHaveBeenCalledWith(baseItem);
    // A linha de ações tem stopPropagation: clicar ali não abre a ficha do lead.
    expect(onView).not.toHaveBeenCalled();
  });
});
