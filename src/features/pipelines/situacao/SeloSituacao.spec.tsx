import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SeloSituacao from './SeloSituacao';

describe('SeloSituacao', () => {
  it('card aberto não tem selo', () => {
    const { container } = render(<SeloSituacao status="open" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Perdido; o detalhe (data e motivo) vai ao passar o mouse', () => {
    render(<SeloSituacao status="lost" detalhe="Perdido em 05/10/2026 · Adiou a compra" />);
    const selo = screen.getByText('Perdido');
    expect(selo).toHaveAttribute('title', 'Perdido em 05/10/2026 · Adiou a compra');
    expect(selo).toHaveAttribute('data-situacao', 'lost');
  });

  it('Ganho, sem detalhe', () => {
    render(<SeloSituacao status="won" />);
    expect(screen.getByText('Ganho')).not.toHaveAttribute('title');
  });
});
