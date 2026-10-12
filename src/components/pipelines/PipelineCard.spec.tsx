// Cartão do funil (peça 9, 10/10/2026): a lixeira solta do rodapé saiu; Excluir
// mora só no menu ⋮ ("Mais ações"), depois do separador, em vermelho.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PipelineCard from './PipelineCard';
import type { Pipeline } from '@/types/analytics';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// t devolve o texto real de pt-BR (pipelines.json), pra o nome do item ser o que o usuário lê.
vi.mock('@/hooks/useLanguage', async () => {
  const pt = (await import('@/i18n/locales/pt-BR/pipelines.json')).default as Record<string, unknown>;
  const resolver = (chave: string) =>
    chave.split('.').reduce<unknown>((no, parte) => (no && typeof no === 'object' ? (no as Record<string, unknown>)[parte] : undefined), pt);
  return {
    useLanguage: () => ({
      t: (chave: string, opcoes?: { defaultValue?: string }) => {
        const valor = resolver(chave);
        return typeof valor === 'string' ? valor : (opcoes?.defaultValue ?? chave);
      },
    }),
  };
});

beforeEach(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

const pipeline = {
  id: '3',
  name: 'Funil Compradores',
  description: '',
  pipeline_type: 'custom',
  is_active: true,
  is_default: false,
  item_count: 0,
  stages: [],
} as unknown as Pipeline;

const acoes = () => ({
  onView: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onDuplicate: vi.fn(),
  onToggleStatus: vi.fn(), onSetAsDefault: vi.fn(),
});

describe('PipelineCard: Excluir mora só no menu ⋮ (peça 9)', () => {
  it('não tem lixeira solta no rodapé do cartão', () => {
    render(<PipelineCard pipeline={pipeline} {...acoes()} />);
    expect(screen.queryByRole('button', { name: 'Excluir funil' })).toBeNull();
  });

  it('Excluir continua no menu ⋮ e chama onDelete', async () => {
    const a = acoes();
    render(<PipelineCard pipeline={pipeline} {...a} />);
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Excluir/ }));
    expect(a.onDelete).toHaveBeenCalledWith(pipeline);
  });
});
