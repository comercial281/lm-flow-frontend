import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/ds';
import BotaoMaisAcoes from './BotaoMaisAcoes';

describe('BotaoMaisAcoes: gatilho do menu ⋮', () => {
  it('é o ⋮ em pé, com nome e dica "Mais ações", no tamanho de ícone', () => {
    const { container } = render(<BotaoMaisAcoes />);
    const botao = screen.getByRole('button', { name: 'Mais ações' });
    expect(botao).toHaveAttribute('title', 'Mais ações');
    expect(botao).toHaveAttribute('type', 'button');
    expect(botao.className).toContain('size-9');
    expect(container.querySelector('svg.lucide-ellipsis-vertical')).not.toBeNull();
  });

  it('compacto desce pra 32 px; aria-label próprio troca só o nome lido', () => {
    render(<BotaoMaisAcoes compacto aria-label="Opções de Visita" />);
    const botao = screen.getByRole('button', { name: 'Opções de Visita' });
    expect(botao.className).toContain('size-8');
    expect(botao.className).not.toContain('size-9');
    expect(botao).toHaveAttribute('title', 'Mais ações');
  });

  it('abre o menu como gatilho do DropdownMenu', async () => {
    const aoExcluir = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <BotaoMaisAcoes />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem variant="destructive" onSelect={aoExcluir}>Excluir</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Excluir' }));
    expect(aoExcluir).toHaveBeenCalled();
  });
});
