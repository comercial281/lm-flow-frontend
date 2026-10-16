import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CampoDeDinheiro } from './campos';

describe('CampoDeDinheiro', () => {
  it('aceita 244.630,00 e entrega o número', async () => {
    const aoMudar = vi.fn();
    render(<CampoDeDinheiro aria-label="Valor" valor={null} aoMudar={aoMudar} />);
    await userEvent.type(screen.getByLabelText('Valor'), '244.630,00');
    expect(aoMudar).toHaveBeenLastCalledWith(244630);
    expect(screen.getByLabelText('Valor')).toHaveValue('244.630,00');
  });

  it('apagar tudo entrega nulo', async () => {
    const aoMudar = vi.fn();
    render(<CampoDeDinheiro aria-label="Valor" valor={500} aoMudar={aoMudar} />);
    await userEvent.clear(screen.getByLabelText('Valor'));
    expect(aoMudar).toHaveBeenLastCalledWith(null);
  });

  it('valor trocado por fora aparece formatado', async () => {
    function Casca() {
      const [v, setV] = useState<number | null>(null);
      return (
        <>
          <button type="button" onClick={() => setV(267818.06)}>preencher</button>
          <CampoDeDinheiro aria-label="Valor" valor={v} aoMudar={setV} />
        </>
      );
    }
    render(<Casca />);
    await userEvent.click(screen.getByText('preencher'));
    expect(screen.getByLabelText('Valor')).toHaveValue('267.818,06');
  });
});
