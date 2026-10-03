import { describe, it, expect } from 'vitest';
import { menuPagesLinks } from './portalMenu';

describe('menuPagesLinks', () => {
  it('páginas do menu viram links /portal/:tenant/p/:slug na ordem recebida', () => {
    const site = { menu: [{ title: 'Sobre nós', slug: 'sobre' }, { title: 'Trabalhe conosco', slug: 'vagas' }] };
    expect(menuPagesLinks(site, 'imob')).toEqual([
      { label: 'Sobre nós', href: '/portal/imob/p/sobre' },
      { label: 'Trabalhe conosco', href: '/portal/imob/p/vagas' },
    ]);
  });
  it('sem menu, lista vazia; ignora item sem slug', () => {
    expect(menuPagesLinks({}, 'imob')).toEqual([]);
    expect(menuPagesLinks({ menu: [{ title: 'X', slug: '' }] }, 'imob')).toEqual([]);
  });
});
