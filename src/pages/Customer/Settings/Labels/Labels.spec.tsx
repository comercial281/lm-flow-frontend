import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Labels from './Labels';
import { labelsService } from '@/services/contacts/labelsService';
import { useAppDataStore } from '@/store/appDataStore';

vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: () => ({ can: () => true, isReady: true }),
}));

const lbl = (id: string, title: string, category: string, display_name: string, extra = {}) =>
  ({ id, title, category, display_name, color: '#ef4444', show_on_sidebar: true, created_at: '', updated_at: '', contacts_count: 3, ...extra });

const imoveis = Array.from({ length: 25 }, (_, i) => lbl(`p${i}`, `im${String(i).padStart(4, '0')}`, 'property', `IM${String(i).padStart(4, '0')}`));

beforeEach(() => {
  vi.spyOn(labelsService, 'getLabels').mockResolvedValue({
    data: [lbl('1', 'cliente vip', 'own', 'Cliente vip'), lbl('2', 'follow-up-pausado', 'followup', 'Follow-up pausado'), ...imoveis],
    meta: { pagination: { page: 1, page_size: 5000, total: 27, total_pages: 1 } },
  } as never);
});

describe('Tela de Etiquetas', () => {
  it('separa Suas e Do sistema, com caixas fechadas e contagem', async () => {
    render(<Labels />);
    expect(await screen.findByText('Cliente vip')).toBeInTheDocument();
    expect(screen.getByText('em 3 leads', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Imóveis · 25/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('IM0000')).not.toBeInTheDocument();
    expect(screen.queryByText('#ef4444')).not.toBeInTheDocument();
  });

  it('caixa grande mostra 20 e "Mostrar mais"', async () => {
    render(<Labels />);
    await userEvent.click(await screen.findByRole('button', { name: /Imóveis · 25/ }));
    expect(screen.getAllByText(/^IM00/)).toHaveLength(20);
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar mais' }));
    expect(screen.getAllByText(/^IM00/)).toHaveLength(25);
  });

  it('do sistema só tem Trocar cor no "…"', async () => {
    render(<Labels />);
    await userEvent.click(await screen.findByRole('button', { name: /Follow-up · 1/ }));
    const linha = screen.getByText('Follow-up pausado').closest('[data-linha-etiqueta]') as HTMLElement;
    await userEvent.click(within(linha).getByRole('button', { name: /^Mais ações/ }));
    expect(screen.getByRole('menuitem', { name: 'Trocar cor' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Excluir' })).not.toBeInTheDocument();
  });

  it('trocar cor atualiza a bolinha e o catálogo guardado, sem recarregar', async () => {
    // Formato real: extractData já entrega a etiqueta pura.
    vi.spyOn(labelsService, 'shuffleColor').mockResolvedValue(lbl('1', 'cliente vip', 'own', 'Cliente vip', { color: '#3b82f6' }) as never);
    const fetchLabels = vi.fn().mockResolvedValue(undefined);
    useAppDataStore.setState({ fetchLabels, labels: [lbl('1', 'cliente vip', 'own', 'Cliente vip')] as never });
    render(<Labels />);
    const linha = (await screen.findByText('Cliente vip')).closest('[data-linha-etiqueta]') as HTMLElement;
    await userEvent.click(within(linha).getByRole('button', { name: /^Mais ações/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Trocar cor' }));
    expect(within(linha).getByTestId('bolinha')).toHaveStyle({ backgroundColor: '#3b82f6' });
    expect(useAppDataStore.getState().labels[0].color).toBe('#3b82f6');
    expect(fetchLabels).not.toHaveBeenCalled();
  });

  it('o nome da etiqueta própria é botão e abre a edição; o do sistema não é', async () => {
    render(<Labels />);
    await userEvent.click(await screen.findByRole('button', { name: 'Cliente vip' }));
    // Sem i18n nos testes o título aparece como chave.
    expect(await screen.findByRole('dialog')).toHaveTextContent(/modal\.title\.edit|Editar etiqueta/);
  });

  it('nome de etiqueta do sistema não é botão', async () => {
    render(<Labels />);
    await userEvent.click(await screen.findByRole('button', { name: /Follow-up · 1/ }));
    expect(screen.getByText('Follow-up pausado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Follow-up pausado' })).not.toBeInTheDocument();
  });

  it('editar atualiza a linha', async () => {
    vi.spyOn(labelsService, 'updateLabel').mockResolvedValue(lbl('1', 'cliente top', 'own', 'Cliente top') as never);
    vi.spyOn(useAppDataStore.getState(), 'fetchLabels').mockResolvedValue(undefined);
    render(<Labels />);
    await userEvent.click(await screen.findByRole('button', { name: 'Cliente vip' }));
    await userEvent.click(await screen.findByRole('button', { name: /modal\.buttons\.update|Salvar/ }));
    expect(await screen.findByText('Cliente top')).toBeInTheDocument();
  });

  it('busca abre a caixa certa', async () => {
    render(<Labels />);
    await userEvent.type(await screen.findByRole('searchbox'), 'pausado');
    expect(screen.getByText('Follow-up pausado')).toBeInTheDocument();
    expect(screen.queryByText('Cliente vip')).not.toBeInTheDocument();
  });
});
