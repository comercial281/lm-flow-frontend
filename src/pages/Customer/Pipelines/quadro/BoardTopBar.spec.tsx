// src/pages/Customer/Pipelines/quadro/BoardTopBar.spec.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Pipeline } from '@/types/analytics';
import BoardTopBar from './BoardTopBar';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (chave: string, reserva?: unknown) => (typeof reserva === 'string' ? reserva : chave) }),
}));
vi.mock('@/pages/Customer/Pipelines/pipelinePayloadCache', () => ({ prefetchPipeline: vi.fn() }));

const funil = {
  id: 'p1', name: 'Leads (Marketing)', description: 'Funil padrão da imobiliária', pipeline_type: 'sale',
  status_counts: { open: 312, won: 2, lost: 154, all: 468, archived: 40 },
} as unknown as Pipeline;

function montar(extra: Partial<Parameters<typeof BoardTopBar>[0]> = {}) {
  const acoes = {
    onTrocarFunil: vi.fn(), onVoltar: vi.fn(), onTrocarAba: vi.fn(), onBusca: vi.fn(), onModo: vi.fn(),
    onAbrirFiltros: vi.fn(), onAdicionar: vi.fn(), onExportar: vi.fn(), onDisparo: vi.fn(),
    onEditarFunil: vi.fn(), onReordenarEtapas: vi.fn(), onCopiarId: vi.fn(), onExcluirFunil: vi.fn(),
  };
  render(
    <MemoryRouter>
      <BoardTopBar pipeline={funil} pipelines={[funil]} aba="abertos" contagens={funil.status_counts} busca=""
        totalVisivel={312} modo="board" quantosFiltros={3} podeAdicionar acoes={{ exportar: true, disparo: true }}
        {...acoes} {...extra} />
    </MemoryRouter>,
  );
  return acoes;
}

describe('topo do funil em três faixas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
  });

  it('o seletor do funil é um selo só com o nome (sem descrição)', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Leads (Marketing)' })).toBeInTheDocument();
    expect(screen.queryByText(/Funil padrão da imobiliária/)).toBeNull();
    expect(screen.queryByText('pipelineSwitcher.noDescription')).toBeNull();
  });

  it('abas com os números; Arquivados é a caixa com o número e o nome', async () => {
    const { onTrocarAba } = montar();
    expect(screen.getByRole('tab', { name: 'Abertos 312' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Perdidos 154' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Todos 468' })).toBeInTheDocument();
    // O número vai no nome que o leitor de tela lê.
    const arquivados = screen.getByRole('button', { name: 'Arquivados 40' });
    expect(arquivados).toHaveAttribute('title', 'Arquivados');
    expect(arquivados).toHaveTextContent('40');
    expect(arquivados).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('tab', { name: 'Ganhos 2' }));
    expect(onTrocarAba).toHaveBeenCalledWith('ganhos');
    await userEvent.click(arquivados);
    expect(onTrocarAba).toHaveBeenLastCalledWith('arquivados');
  });

  it('na aba Arquivados nenhuma das quatro fica marcada e a caixa sim', () => {
    montar({ aba: 'arquivados' });
    expect(screen.getAllByRole('tab').every(t => t.getAttribute('aria-selected') === 'false')).toBe(true);
    expect(screen.getByRole('button', { name: /^Arquivados/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('faixa 3: busca, contador, Quadro|Lista e Filtros com a contagem', async () => {
    const { onModo, onAbrirFiltros, onBusca } = montar();
    expect(screen.getByText('312 leads')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Quadro' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Lista' }));
    expect(onModo).toHaveBeenCalledWith('list');
    await userEvent.click(screen.getByRole('button', { name: 'Filtros · 3' }));
    expect(onAbrirFiltros).toHaveBeenCalled();
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar lead' }), 'M');
    expect(onBusca).toHaveBeenCalledWith('M');
  });

  it('sem contagem de etapas, total de leads no topo, valor total nem Importar', () => {
    montar();
    expect(screen.queryByText('kanban.header.stages')).toBeNull();
    expect(screen.queryByText('kanban.header.totalValue')).toBeNull();
    expect(screen.queryByRole('button', { name: /Importar/ })).toBeNull();
  });

  it('⋯ do funil: os seis itens, nesta ordem', async () => {
    const { onCopiarId } = montar();
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações do funil' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByRole('menuitem').map(i => i.textContent)).toEqual([
      'Exportar', 'Disparo em massa', 'Editar funil', 'Reordenar etapas', 'Copiar ID', 'Excluir funil',
    ]);
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Copiar ID' }));
    expect(onCopiarId).toHaveBeenCalled();
  });

  it('sem a função ou o cargo, Exportar e Disparo em massa somem do ⋯', async () => {
    montar({ acoes: { exportar: false, disparo: false }, podeAdicionar: false });
    expect(screen.queryByRole('button', { name: 'Lead' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações do funil' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: 'Exportar' })).toBeNull();
    expect(within(menu).queryByRole('menuitem', { name: 'Disparo em massa' })).toBeNull();
  });
});
