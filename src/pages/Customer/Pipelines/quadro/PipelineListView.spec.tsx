// src/pages/Customer/Pipelines/quadro/PipelineListView.spec.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PipelineStage } from '@/types/analytics';
import PipelineListView from './PipelineListView';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (chave: string, reserva?: unknown) => (typeof reserva === 'string' ? reserva : chave) }),
}));
vi.mock('@/components/roleta/OfferActions', () => ({
  default: ({ fallback }: { fallback?: React.ReactNode }) => <>{fallback ?? null}</>,
}));

const STAGES = [
  { id: 's1', name: 'Novo', color: '#3b82f6', items: [
    { id: 'i1', pipeline_id: 'p1', status: 'lost', entered_at: 1_791_298_800,
      contact: { id: 'c1', name: 'Maria Souza', phone_number: '+5511999990000', labels: [{ name: 'Meta', color: '#000000' }] },
      assignee: { id: 'u1', name: 'Ana Paula' }, roleta: { id: 'r1', name: 'Zona Sul' },
      tasks_info: { overdue_count: 1 } },
  ] },
  { id: 's2', name: 'Proposta', color: '#8b5cf6', items: [
    { id: 'i2', pipeline_id: 'p1', status: 'open', entered_at: 1_790_866_800, contact: { id: 'c2', name: 'João Lima' }, tasks_info: {} },
  ] },
] as unknown as PipelineStage[];

const montar = (extra: Partial<Parameters<typeof PipelineListView>[0]> = {}) => {
  const props = { stages: STAGES, ordem: 'desc' as const, aoTrocarOrdem: vi.fn(), onOpenItem: vi.fn(), visitsByContact: {}, ...extra };
  render(<PipelineListView {...props} />);
  return props;
};

describe('Lista do funil enxuta', () => {
  it('cabeçalho com Etapa (não Coluna) e as colunas novas', () => {
    montar();
    for (const titulo of ['Lead', 'Etapa', 'Responsável', 'Sinal']) expect(screen.getByText(titulo)).toBeInTheDocument();
    expect(screen.queryByText('Coluna')).toBeNull();
    expect(screen.queryByText('Etiquetas')).toBeNull();
  });

  it('linha: selo, nome com ↗, etapa, dono e o único sinal; sem telefone, código, roleta e etiquetas', () => {
    montar();
    expect(screen.getByText('Perdido')).toHaveAttribute('data-situacao', 'lost');
    expect(screen.getAllByRole('link', { name: 'Abrir o card completo em nova guia' })[0]).toHaveAttribute('href', '/pipelines/p1/card/i1');
    expect(screen.getAllByText('Novo').length).toBeGreaterThan(0);
    expect(screen.getByText('Ana Paula')).toBeInTheDocument();
    expect(screen.getByText('Tarefa atrasada')).toBeInTheDocument();
    for (const fora of ['(11) 99999-0000', 'Meta', 'Zona Sul']) expect(screen.queryByText(fora)).toBeNull();
    expect(screen.queryByText(/^#/)).toBeNull();
  });

  it('mais novo primeiro; o botão Chegou troca a ordem', async () => {
    const { aoTrocarOrdem } = montar();
    const nomes = screen.getAllByTestId('nome-na-lista').map(n => n.textContent);
    expect(nomes).toEqual(['Maria Souza', 'João Lima']);
    await userEvent.click(screen.getByRole('button', { name: /Chegou/ }));
    expect(aoTrocarOrdem).toHaveBeenCalled();
  });

  it('clicar na linha abre o card; clicar na setinha não', async () => {
    const { onOpenItem } = montar();
    await userEvent.click(screen.getByText('João Lima'));
    expect(onOpenItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'i2' }));
    onOpenItem.mockClear();
    const setas = screen.getAllByRole('link', { name: 'Abrir o card completo em nova guia' });
    setas[1].addEventListener('click', e => e.preventDefault());
    await userEvent.click(setas[1]);
    expect(onOpenItem).not.toHaveBeenCalled();
  });

  it('vazia: diz que não há lead', () => {
    montar({ stages: [{ ...STAGES[0], items: [] }] as unknown as PipelineStage[] });
    expect(screen.getByText('Nenhum lead nesta aba com esses filtros.')).toBeInTheDocument();
  });
});
