import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './ds';

/* Peça 14 do GLOSSARIO: o degradê roxo é só do botão principal. O CSS
   (globals.css) mira `[data-slot='button'][data-variant='default'].bg-primary`,
   então o Button da casa tem que marcar a variante no HTML. */
describe('Button da casa', () => {
  it('sem variante, marca o principal (default) e mantém o bg-primary do pacote', () => {
    render(<Button>Salvar</Button>);
    const botao = screen.getByRole('button', { name: 'Salvar' });
    expect(botao).toHaveAttribute('data-slot', 'button');
    expect(botao).toHaveAttribute('data-variant', 'default');
    expect(botao.className).toMatch(/(^|\s)bg-primary(\s|$)/);
  });

  it('marca a variante pedida (contorno não ganha degradê)', () => {
    render(<Button variant="outline" size="sm">Cancelar</Button>);
    const botao = screen.getByRole('button', { name: 'Cancelar' });
    expect(botao).toHaveAttribute('data-variant', 'outline');
    expect(botao.className).not.toMatch(/(^|\s)bg-primary(\s|$)/);
  });

  it('repassa clique, ref e asChild como o do pacote', async () => {
    const aoClicar = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(
      <>
        <Button ref={ref} onClick={aoClicar}>Criar</Button>
        <Button asChild><a href="/x">Abrir</a></Button>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(aoClicar).toHaveBeenCalledTimes(1);
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Criar' }));
    expect(screen.getByRole('link', { name: 'Abrir' })).toHaveAttribute('data-variant', 'default');
  });
});
