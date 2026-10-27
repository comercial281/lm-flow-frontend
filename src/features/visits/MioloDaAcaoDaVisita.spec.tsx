import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MioloDoRetornoDaVisita } from './MioloDaAcaoDaVisita';

describe('MioloDoRetornoDaVisita', () => {
  it('estrelas marcadas são âmbar, como na Lista e na janela (nunca roxo)', () => {
    const { container } = render(
      <MioloDoRetornoDaVisita nota={3} aoMudarNota={() => {}} comentario="" aoMudarComentario={() => {}} />,
    );
    expect(container.querySelectorAll('svg.fill-amber-400').length).toBe(3);
    expect(container.innerHTML).not.toContain('violet');
  });
});
