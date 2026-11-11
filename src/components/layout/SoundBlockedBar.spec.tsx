import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

let bloqueado = false;
const playLeadAlert = vi.fn(async () => true);
const clearSoundBlocked = vi.fn();
vi.mock('@/lib/plantaoSound/leadAlert', () => ({
  useSoundBlocked: () => bloqueado,
  playLeadAlert: () => playLeadAlert(),
  clearSoundBlocked: () => clearSoundBlocked(),
}));

import SoundBlockedBar from './SoundBlockedBar';

// A faixa só existe depois que o navegador recusou o som de verdade (o dono vetou
// faixa que aparece para todo mundo). O clique dela já é o clique que o navegador
// pede para liberar o som.
describe('SoundBlockedBar', () => {
  beforeEach(() => {
    bloqueado = false;
    playLeadAlert.mockClear();
    clearSoundBlocked.mockClear();
  });

  it('sem bloqueio, não desenha nada', () => {
    const { container } = render(<SoundBlockedBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it('com bloqueio, mostra a faixa; o clique toca o som e some com ela', () => {
    bloqueado = true;
    render(<SoundBlockedBar />);
    const botao = screen.getByRole('button', { name: 'O navegador bloqueou o som do plantão. Clique aqui pra ligar.' });
    fireEvent.click(botao);
    expect(playLeadAlert).toHaveBeenCalledTimes(1);
    expect(clearSoundBlocked).toHaveBeenCalledTimes(1);
  });
});
