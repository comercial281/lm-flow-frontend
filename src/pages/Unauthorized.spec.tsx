// Tela "Sem permissão": no tema escuro o Aviso fica âmbar claro; com fundo fixo
// claro (bg-gray-50 / bg-white) o texto ficava quase ilegível. A página segue o tema.
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Unauthorized from './Unauthorized';

afterEach(() => document.documentElement.classList.remove('dark'));

describe('Sem permissão · tema escuro', () => {
  it('nenhum fundo fixo claro, e o aviso para falar com o administrador continua', () => {
    document.documentElement.classList.add('dark');
    const { container } = render(<MemoryRouter><Unauthorized /></MemoryRouter>);
    expect(container.querySelector('.bg-white, .bg-gray-50')).toBeNull();
    expect(container.querySelector('[class*="text-gray-"]')).toBeNull();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
