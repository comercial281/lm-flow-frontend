import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NoAccessState from './NoAccessState';
import { NO_ACCESS_MESSAGE } from './noAccessCopy';

describe('NoAccessState', () => {
  it('diz o que aconteceu e quem libera, com o texto da spec', () => {
    expect(NO_ACCESS_MESSAGE).toBe('Seu cargo não tem acesso a esta tela. Quem libera é o administrador da conta.');
    render(<NoAccessState />);
    expect(screen.getByRole('status')).toHaveTextContent(NO_ACCESS_MESSAGE);
  });
});
