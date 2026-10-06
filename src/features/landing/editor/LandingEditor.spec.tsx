import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { LandingEditor } from './LandingEditor';
import { useLandingEditorStore } from './landingEditorStore';
import { createBlock, type LandingProperty } from '@/features/landing/blocks';

const property: LandingProperty = {
  code: 'AP-001',
  title: 'The White Palace',
  stage: 'pre_launch',
  salePrice: 800000,
  bedrooms: 3,
};

/** A biblioteca agora abre por "Adicionar seção" — antes ela ficava sempre
 *  aberta ocupando a coluna, junto de todo o resto. */
function addSection(label: string) {
  fireEvent.click(screen.getByRole('button', { name: /Adicionar seção/ }));
  fireEvent.click(screen.getByRole('button', { name: label }));
}

describe('LandingEditor (integração UI)', () => {
  beforeEach(() => useLandingEditorStore.getState().load([]));

  it('adiciona uma seção pela biblioteca e o preview renderiza com dados do imóvel', () => {
    render(<LandingEditor initialBlocks={[]} property={property} onSave={vi.fn()} />);
    addSection('Hero / Capa');
    expect(screen.getByText('The White Palace')).toBeInTheDocument();
    expect(screen.getByText('PRÉ LANÇAMENTO')).toBeInTheDocument();
  });

  it('Salvar fica habilitado após editar e chama onSave com os blocos', () => {
    const onSave = vi.fn();
    render(<LandingEditor initialBlocks={[]} property={property} onSave={onSave} />);
    const saveBtn = screen.getByRole('button', { name: /Salvar/ });
    expect(saveBtn).toBeDisabled(); // nada sujo ainda
    addSection('Faixa de Preço');
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toHaveLength(1);
  });

  it('oculta e exclui seções', () => {
    render(<LandingEditor initialBlocks={[]} property={property} onSave={vi.fn()} />);
    addSection('Galeria de Fotos');
    expect(useLandingEditorStore.getState().blocks).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }));
    expect(useLandingEditorStore.getState().blocks[0].visible).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(useLandingEditorStore.getState().blocks).toHaveLength(0);
  });

  it('a seção do formulário abre em perguntas, e cada pergunta abre o painel dela', () => {
    const block = createBlock('lead_form');
    render(<LandingEditor initialBlocks={[block]} onSave={vi.fn()} />);

    // Selecionar a seção do formulário revela as perguntas na árvore.
    fireEvent.click(screen.getByRole('button', { name: /Formulário de Lead/ }));
    const primeira = screen.getByRole('button', { name: /Quando você pretende comprar/ });
    fireEvent.click(primeira);

    // O painel da direita passa a mostrar SÓ aquela pergunta.
    const painel = screen.getByRole('heading', { name: 'Pergunta' }).closest('aside')!;
    expect(within(painel).getByDisplayValue('Quando você pretende comprar?')).toBeInTheDocument();
    // E cada resposta tem campo próprio — é isso que devolve espaço e Enter.
    expect(within(painel).getByDisplayValue('Quero fechar o quanto antes')).toBeInTheDocument();
  });

  it('a seção de Texto entra pela biblioteca, no grupo Conteúdo', () => {
    render(<LandingEditor initialBlocks={[]} onSave={vi.fn()} />);
    addSection('Texto');
    const blocks = useLandingEditorStore.getState().blocks;
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('rich_text');
  });

  it('digitar espaço no fim de uma resposta não some mais', () => {
    const block = createBlock('lead_form');
    render(<LandingEditor initialBlocks={[block]} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Formulário de Lead/ }));
    fireEvent.click(screen.getByRole('button', { name: /Como pretende pagar/ }));

    const campo = screen.getByDisplayValue('Vou pagar à vista');
    fireEvent.change(campo, { target: { value: 'Vou pagar à vista ' } });

    const steps = (useLandingEditorStore.getState().blocks[0].config as { steps: { options: { text: string }[] }[] })
      .steps;
    expect(steps[1].options.map((o) => o.text)).toContain('Vou pagar à vista ');
  });

  it('Custo Mensal entra pela biblioteca com o título padrão e aceita linha extra', () => {
    render(<LandingEditor initialBlocks={[]} property={property} onSave={vi.fn()} />);
    addSection('Custo Mensal');
    fireEvent.click(screen.getByRole('button', { name: /Custo Mensal/ }));
    const cfg = () => useLandingEditorStore.getState().blocks[0].config as { title: string; extras: { label: string; value: number }[] };
    expect(cfg().title).toBe('Custo mensal');
    fireEvent.click(screen.getByText('+ linha'));
    expect(cfg().extras).toHaveLength(1);
    fireEvent.change(screen.getByPlaceholderText('Seguro incêndio'), { target: { value: 'Taxa' } });
    expect(cfg().extras[0].label).toBe('Taxa');
    fireEvent.click(screen.getByText('excluir'));
    expect(cfg().extras).toHaveLength(0);
  });

  it('Passo a Passo permite incluir, editar e remover, até 6', () => {
    render(<LandingEditor initialBlocks={[]} property={property} onSave={vi.fn()} />);
    addSection('Passo a Passo');
    fireEvent.click(screen.getByRole('button', { name: /Passo a Passo/ }));
    const cfg = () => useLandingEditorStore.getState().blocks[0].config as { items: { title: string; text: string }[] };
    for (let i = 0; i < 7; i++) {
      const add = screen.queryByText('+ passo');
      if (add) fireEvent.click(add);
    }
    expect(cfg().items).toHaveLength(6);
    expect(screen.queryByText('+ passo')).toBeNull();
    fireEvent.change(screen.getAllByPlaceholderText('Escolha o imóvel')[0], { target: { value: 'Visita' } });
    expect(cfg().items[0].title).toBe('Visita');
    fireEvent.click(screen.getAllByText('excluir')[0]);
    expect(cfg().items).toHaveLength(5);
  });
});
