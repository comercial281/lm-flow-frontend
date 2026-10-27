import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select, SelectTrigger, SelectValue } from './ds';

/* Opção de nome comprido não pode alargar a janela (destino do formulário com
   imóvel de nome gigante, 27/10/2026): o botão encolhe e o texto corta com "…".
   O Seletor usa este botão no computador; a lista do celular não estica. */
describe('caixa de escolha que não estica a janela', () => {
  it('o botão do design system pode encolher e corta o texto escolhido', () => {
    render(
      <Select value="a">
        <SelectTrigger className="w-full" aria-label="Imóvel">
          <SelectValue placeholder="Escolha" />
        </SelectTrigger>
      </Select>,
    );
    const botao = screen.getByRole('combobox', { name: 'Imóvel' });
    expect(botao.className).toMatch(/(^|\s)min-w-0(\s|$)/);
    expect(botao.className).toMatch(/(^|\s)max-w-full(\s|$)/);
    expect(botao.className).toContain('*:data-[slot=select-value]:truncate');
    // A classe de quem chama continua valendo.
    expect(botao.className).toMatch(/(^|\s)w-full(\s|$)/);
  });

});
