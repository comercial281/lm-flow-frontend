import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from './ds';

/* O botão de fechar do painel lateral do design system tem o nome "Close", em
   inglês, para quem usa leitor de tela. O SheetContent da casa põe o "Fechar" e
   esconde o do pacote (que é sempre o último filho do painel). */
describe('SheetContent da casa', () => {
  function abrir(onOpenChange = vi.fn()) {
    render(
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-lg">
          <SheetTitle>Painel</SheetTitle>
          <SheetDescription>teste</SheetDescription>
          <p>conteúdo</p>
        </SheetContent>
      </Sheet>,
    );
    return onOpenChange;
  }

  it('o botão de fechar se chama "Fechar" e fecha', async () => {
    const onOpenChange = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('esconde o "Close" do pacote e mantém a className de quem chama', () => {
    abrir();
    const painel = screen.getByRole('dialog', { name: 'Painel' });
    expect(painel.className).toContain('[&>button:last-child]:hidden');
    expect(painel.className).toContain('sm:max-w-lg');
    const ultimo = painel.lastElementChild as HTMLElement;
    expect(ultimo.tagName).toBe('BUTTON');
    expect(ultimo.textContent).toBe('Close');
  });
});
