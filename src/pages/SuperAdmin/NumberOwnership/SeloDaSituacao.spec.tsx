import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SeloDaSituacao from './SeloDaSituacao';

describe('SeloDaSituacao', () => {
  it('caído: "Caiu há…" em vermelho', () => {
    render(
      <SeloDaSituacao situacao="disconnected" desde={new Date(2026, 9, 6, 14, 3).toISOString()}
        agora={new Date(2026, 9, 6, 16, 3)} />,
    );
    expect(screen.getByText('Caiu há 2 h (desde 06/10 14:03)').className).toContain('text-red-700');
  });

  it('API oficial: neutro, com o texto da spec', () => {
    render(<SeloDaSituacao situacao="official" />);
    expect(screen.getByText('API oficial · sem conexão a vigiar').className).toContain('text-muted-foreground');
  });
});
