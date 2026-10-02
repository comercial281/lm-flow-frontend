import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuickFilters from './QuickFilters';

vi.mock('@/services/chat/chatService', () => ({
  default: { getAvailableLabels: vi.fn().mockResolvedValue([{ id: 1, title: 'quente' }, { id: 2, title: 'frio' }]) },
}));
vi.mock('@/services/users/usersService', () => ({
  default: { getUsers: vi.fn().mockResolvedValue({ data: [] }) },
}));
vi.mock('@/services/roletaConfig/roletaConfigService', () => ({
  roletaConfigService: { getAll: vi.fn().mockResolvedValue([]) },
  roletaLabel: (r: { name: string }) => r.name,
}));

beforeEach(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false, media: '(pointer: coarse)', addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  // @ts-expect-error: o jsdom não tem matchMedia; voltamos a não ter.
  delete window.matchMedia;
});

describe('QuickFilters no computador', () => {
  it('escolher na lista do produto aplica a etiqueta sem fechar a caixinha', async () => {
    const onApply = vi.fn();
    render(<QuickFilters filters={[]} inboxOptions={[]} onApply={onApply} onOpenAdvanced={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'quente' }));
    expect(onApply).toHaveBeenCalledWith([
      { attributeKey: 'labels', filterOperator: 'equal_to', values: 'quente', queryOperator: 'and', attributeModel: 'standard' },
    ]);
    expect(screen.getByRole('dialog', { name: 'Filtros rápidos' })).toBeInTheDocument();
  });

  it('Esc com a lista aberta fecha só a lista', async () => {
    render(<QuickFilters filters={[]} inboxOptions={[]} onApply={() => {}} onOpenAdvanced={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    await userEvent.click(await screen.findByRole('combobox'));
    await screen.findByRole('listbox');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Filtros rápidos' })).toBeInTheDocument();
  });

  it('clique fora de tudo continua fechando a caixinha', async () => {
    render(<><p>fora</p><QuickFilters filters={[]} inboxOptions={[]} onApply={() => {}} onOpenAdvanced={() => {}} /></>);
    await userEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    expect(screen.getByRole('dialog', { name: 'Filtros rápidos' })).toBeInTheDocument();
    await userEvent.click(screen.getByText('fora'));
    expect(screen.queryByRole('dialog', { name: 'Filtros rápidos' })).not.toBeInTheDocument();
  });

  it('clique que chega no html com a lista aberta fecha só a lista, não a caixinha', async () => {
    render(<QuickFilters filters={[]} inboxOptions={[]} onApply={() => {}} onOpenAdvanced={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    await userEvent.click(await screen.findByRole('combobox'));
    await screen.findByRole('listbox');
    // Com a lista aberta o Radix desliga os cliques no body: no navegador o mousedown chega no <html>.
    fireEvent.mouseDown(document.documentElement);
    // hidden: com a lista aberta o Radix esconde o resto da tela dos leitores (aria-hidden).
    expect(screen.getByRole('dialog', { name: 'Filtros rápidos', hidden: true })).toBeInTheDocument();
  });
});
