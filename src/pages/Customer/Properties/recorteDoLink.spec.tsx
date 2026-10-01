// src/pages/Customer/Properties/recorteDoLink.spec.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChipDaDashboard } from '@/features/dashboard/ChipDaDashboard';

describe('ChipDaDashboard', () => {
  it('diz de onde veio o filtro e tira ao clicar', () => {
    const tirar = vi.fn();
    render(<ChipDaDashboard rotulo="Sem fotos" onTirar={tirar} />);
    expect(screen.getByText('Da Dashboard: Sem fotos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tirar o filtro da Dashboard' }));
    expect(tirar).toHaveBeenCalledTimes(1);
  });

  it('sem rótulo, não desenha nada', () => {
    const { container } = render(<ChipDaDashboard rotulo="" onTirar={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
