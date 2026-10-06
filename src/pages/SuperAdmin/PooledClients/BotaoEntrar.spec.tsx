import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BotaoEntrar from './BotaoEntrar';

describe('BotaoEntrar', () => {
  it('é o botão do login (degradê com brilho) e chama ao clicar', () => {
    const aoClicar = vi.fn();
    render(<BotaoEntrar aoClicar={aoClicar} />);
    const b = screen.getByRole('button', { name: 'Entrar' });
    expect(b.className).toContain('lmf-btn-shimmer');
    fireEvent.click(b);
    expect(aoClicar).toHaveBeenCalledTimes(1);
  });

  it('entrando: trava e avisa', () => {
    render(<BotaoEntrar aoClicar={() => {}} entrando />);
    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled();
  });
});
