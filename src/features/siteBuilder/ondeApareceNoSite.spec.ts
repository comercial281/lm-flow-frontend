import { describe, expect, it } from 'vitest';
import { APARENCIA_FABRICA, type Aparencia } from './public/aparenciaConfig';
import { ondeApareceContato, ondeApareceEndereco, ondeAparecemRedes } from './ondeApareceNoSite';

const ap = (p: Partial<Aparencia>): Aparencia => ({ ...APARENCIA_FABRICA, ...p });

describe('ondeApareceNoSite', () => {
  it('fábrica: rodapé, menu do celular e faixa de cima', () => {
    expect(ondeApareceContato(undefined, 'telefone')).toBe(
      'Aparece no rodapé de todas as páginas, no menu do celular e, no computador, na faixa de cima das páginas internas. No celular, quem toca no número já liga.');
    expect(ondeApareceContato(APARENCIA_FABRICA, 'email')).toBe(
      'Aparece no rodapé de todas as páginas, no menu do celular e, no computador, na faixa de cima das páginas internas.');
    expect(ondeApareceEndereco(undefined)).toBe('Aparece no rodapé do site. Pode usar duas linhas.');
    expect(ondeAparecemRedes(undefined)).toBe(
      'O nome de cada rede aparece como link no rodapé de todas as páginas e, no computador, na faixa de cima das páginas internas.');
  });

  it('faixa só com ícones: as redes e os contatos viram só o ícone', () => {
    expect(ondeAparecemRedes(ap({ top_bar: 'icons' }))).toMatch(/faixa de cima das páginas internas mostra só o ícone de cada rede/);
    expect(ondeApareceContato(ap({ top_bar: 'icons' }), 'telefone')).toMatch(/faixa de cima das páginas internas, só o ícone\./);
  });

  it('telefone e redes (sem e-mail): o e-mail só sobe na faixa quando não há telefone', () => {
    expect(ondeApareceContato(ap({ top_bar: 'one_phone' }), 'email')).toMatch(/só quando não há telefone/);
    expect(ondeApareceContato(ap({ top_bar: 'one_phone' }), 'telefone')).not.toMatch(/só quando/);
  });

  it('rodapé compacto: contatos ficam no menu do celular (nunca "só" na faixa); endereço e redes somem', () => {
    expect(ondeApareceContato(ap({ footer_layout: 'compact' }), 'telefone')).toBe(
      'Aparece no menu do celular e, no computador, na faixa de cima das páginas internas. O rodapé compacto não mostra. No celular, quem toca no número já liga.');
    expect(ondeApareceEndereco(ap({ footer_layout: 'compact' }))).toMatch(/não aparece no site/);
    expect(ondeAparecemRedes(ap({ footer_layout: 'compact' }))).toMatch(/O rodapé compacto não mostra as redes/);
    expect(ondeAparecemRedes(ap({ footer_layout: 'compact', top_bar: 'hidden' }))).toBe(
      'Com o rodapé compacto e sem a faixa de cima, as redes não aparecem no site.');
    expect(ondeApareceContato(ap({ footer_layout: 'compact', top_bar: 'hidden' }), 'email')).toBe(
      'Com o rodapé compacto e sem a faixa de cima, aparece só no menu do celular e na página de manutenção.');
  });

  it('faixa escondida: só o rodapé', () => {
    expect(ondeApareceContato(ap({ top_bar: 'hidden' }), 'telefone')).toBe(
      'Aparece no rodapé de todas as páginas e no menu do celular. No celular, quem toca no número já liga.');
    expect(ondeAparecemRedes(ap({ top_bar: 'hidden' }))).toBe('O nome de cada rede aparece como link no rodapé de todas as páginas.');
  });
});
