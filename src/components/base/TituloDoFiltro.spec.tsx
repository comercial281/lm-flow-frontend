import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import TituloDoFiltro from './TituloDoFiltro';

describe('TituloDoFiltro', () => {
  it('sem htmlFor é um título; com htmlFor é o rótulo do campo', () => {
    render(<><TituloDoFiltro>Número</TituloDoFiltro><TituloDoFiltro htmlFor="x">Responsável</TituloDoFiltro><input id="x" /></>);
    expect(screen.getByText('Número').tagName).toBe('P');
    expect(screen.getByLabelText('Responsável')).toBeInTheDocument();
    expect(screen.getByText('Número').className).toContain('uppercase');
  });
});
