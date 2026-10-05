import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import SeloSituacao from './SeloSituacao';

describe('SeloSituacao', () => {
  it('na barra mostra a frase inteira do veredito', () => {
    render(<SeloSituacao situacao={{ tipo: 'restricao', frase: 'Atendendo com restrição: só quem escrever "call"' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Atendendo com restrição: só quem escrever "call"');
  });

  it('compacto mostra só a palavra e guarda a frase no title', () => {
    render(<SeloSituacao compacto situacao={{ tipo: 'parada', frase: 'Parada: falta o número' }} />);
    const selo = screen.getByRole('status');
    expect(selo).toHaveTextContent(/^Parada$/);
    expect(selo).toHaveAttribute('title', 'Parada: falta o número');
  });

  it('parada é vermelha; restrição, laranja; atendendo, verde', () => {
    const { rerender } = render(<SeloSituacao situacao={{ tipo: 'parada', frase: 'Parada: falta o número' }} />);
    expect(screen.getByRole('status').className).toContain('text-red-700');
    rerender(<SeloSituacao situacao={{ tipo: 'restricao', frase: 'x' }} />);
    expect(screen.getByRole('status').className).toContain('text-amber-700');
    rerender(<SeloSituacao situacao={{ tipo: 'atendendo', frase: 'Atendendo' }} />);
    expect(screen.getByRole('status').className).toContain('text-emerald-700');
  });
});
