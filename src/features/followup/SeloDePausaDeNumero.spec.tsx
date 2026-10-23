import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SeloDePausaDeNumero from './SeloDePausaDeNumero';

describe('SeloDePausaDeNumero', () => {
  it('com pausa mostra "Pausado" com o nome do fluxo no title', () => {
    render(<SeloDePausaDeNumero pausa={{ instance_id: 'i', flow_name: 'Boas-vindas' }} />);
    expect(screen.getByText('Pausado').getAttribute('title')).toBe('Já conversa em outro número: Boas-vindas');
  });
  it('sem pausa não desenha nada', () => {
    const { container, rerender } = render(<SeloDePausaDeNumero pausa={null} />);
    expect(container.firstChild).toBeNull();
    rerender(<SeloDePausaDeNumero pausa={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});
