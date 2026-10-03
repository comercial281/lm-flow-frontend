import { describe, expect, it } from 'vitest';
import { aplicarProprietariosNoMenu } from './menuDeProprietarios';

const secoes = [{ id: 'imoveis', itens: [{ name: 'Meus imóveis', href: '/properties' }, { name: 'Gestão de proprietários', href: '/property-owners' }] }] as never[];

describe('aplicarProprietariosNoMenu', () => {
  it('some quando não é visível', () => {
    const [s] = aplicarProprietariosNoMenu(secoes, { visivel: false, marcador: true }) as { itens: { href: string }[] }[];
    expect(s.itens.map(i => i.href)).toEqual(['/properties']);
  });
  it('marca a bolinha só no item de proprietários', () => {
    const [s] = aplicarProprietariosNoMenu(secoes, { visivel: true, marcador: true }) as { itens: { href: string; marcador?: boolean }[] }[];
    expect(s.itens.map(i => !!i.marcador)).toEqual([false, true]);
  });
  it('seção sem o item passa intacta', () => {
    const outras = [{ id: 'leads', itens: [{ name: 'Contatos', href: '/contacts' }] }] as never[];
    expect(aplicarProprietariosNoMenu(outras, { visivel: false, marcador: true })[0]).toBe(outras[0]);
  });
});
