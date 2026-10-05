import { describe, it, expect } from 'vitest';
import { menuPagesLinks } from './portalMenu';

const LMFLOW = { tenant: 'imob', dominio: false };

describe('menuPagesLinks', () => {
  it('páginas do menu viram links /portal/:tenant/p/:slug na ordem recebida', () => {
    const site = { menu: [{ title: 'Sobre nós', slug: 'sobre' }, { title: 'Trabalhe conosco', slug: 'vagas' }] };
    expect(menuPagesLinks(site, LMFLOW)).toEqual([
      { label: 'Sobre nós', href: '/portal/imob/p/sobre' },
      { label: 'Trabalhe conosco', href: '/portal/imob/p/vagas' },
    ]);
  });
  it('no domínio do cliente o link é /p/:slug', () => {
    const site = { menu: [{ title: 'Quem somos', slug: 'quem somos' }] };
    expect(menuPagesLinks(site, { tenant: 'imob', dominio: true })).toEqual([{ label: 'Quem somos', href: '/p/quem%20somos' }]);
  });
  it('sem menu, lista vazia; ignora item sem slug', () => {
    expect(menuPagesLinks({}, LMFLOW)).toEqual([]);
    expect(menuPagesLinks({ menu: [{ title: 'X', slug: '' }] }, LMFLOW)).toEqual([]);
  });
});
