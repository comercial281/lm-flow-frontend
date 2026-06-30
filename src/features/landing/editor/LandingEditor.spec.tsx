import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LandingEditor } from './LandingEditor';
import { useLandingEditorStore } from './landingEditorStore';
import type { LandingProperty } from '@/features/landing/blocks';

const property: LandingProperty = {
  code: 'AP-001',
  title: 'The White Palace',
  stage: 'pre_launch',
  salePrice: 800000,
  bedrooms: 3,
};

describe('LandingEditor (integração UI)', () => {
  beforeEach(() => useLandingEditorStore.getState().load([]));

  it('adiciona uma seção pela biblioteca e o preview renderiza com dados do imóvel', () => {
    render(<LandingEditor initialBlocks={[]} property={property} onSave={vi.fn()} />);
    // antes de adicionar, só existe o botão da biblioteca chamado "Hero / Capa"
    fireEvent.click(screen.getByRole('button', { name: 'Hero / Capa' }));
    // preview auto-preenche o título do imóvel
    expect(screen.getByText('The White Palace')).toBeInTheDocument();
    expect(screen.getByText('PRÉ LANÇAMENTO')).toBeInTheDocument();
  });

  it('Salvar fica habilitado após editar e chama onSave com os blocos', () => {
    const onSave = vi.fn();
    render(<LandingEditor initialBlocks={[]} property={property} onSave={onSave} />);
    const saveBtn = screen.getByRole('button', { name: /Salvar/ });
    expect(saveBtn).toBeDisabled(); // nada sujo ainda
    fireEvent.click(screen.getByRole('button', { name: 'Faixa de Preço' }));
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toHaveLength(1);
  });

  it('oculta e exclui seções', () => {
    render(<LandingEditor initialBlocks={[]} property={property} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Galeria de Fotos' }));
    expect(useLandingEditorStore.getState().blocks).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }));
    expect(useLandingEditorStore.getState().blocks[0].visible).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(useLandingEditorStore.getState().blocks).toHaveLength(0);
  });
});
