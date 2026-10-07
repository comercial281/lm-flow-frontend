import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { MenuProvider } from '@/contexts/MenuContext';
import { getCustomerMenuSections, type MenuSection, type MenuItem } from '@/components/layout/config/menuItems';
import FacebookIntegracao, { blocosDoFacebook } from './FacebookIntegracao';

vi.mock('@/pages/Customer/Automations/Origem/MetaPagesPanel', () => ({ default: () => <p>painel da página</p> }));
vi.mock('@/pages/Customer/Automations/PixelCapi/PixelCapiConfig', () => ({ default: () => <p>configuração do pixel</p> }));

const integracoes = getCustomerMenuSections().flatMap(s => s.itens).find(i => i.name === 'Integrações')!;
const item = (hrefs: string[]): MenuItem => ({ ...integracoes, abas: integracoes.abas!.filter(a => hrefs.includes(a.href)) });
const secoes = (hrefs: string[]): MenuSection[] => [{ id: 'imobiliaria', rotulo: 'Minha imobiliária', itens: [item(hrefs)] }];

const abrir = (endereco: string, s: MenuSection[]) => render(
  <MemoryRouter initialEntries={[endereco]}><MenuProvider value={s}><FacebookIntegracao /></MenuProvider></MemoryRouter>,
);

describe('Integrações → Facebook', () => {
  const rolar = vi.fn();
  beforeEach(() => {
    rolar.mockClear();
    Element.prototype.scrollIntoView = rolar;
  });

  it('blocosDoFacebook: segue o menu, e o endereço aberto sempre aparece', () => {
    expect(blocosDoFacebook(item(['/settings/facebook', '/settings/pixel-capi']), '/settings/facebook')).toEqual({ pagina: true, pixel: true });
    expect(blocosDoFacebook(item(['/settings/pixel-capi']), '/settings/pixel-capi')).toEqual({ pagina: false, pixel: true });
    // Painel raiz: a Página sumiu do menu, mas o super digitou o endereço dela.
    expect(blocosDoFacebook(item(['/settings/pixel-capi']), '/settings/facebook')).toEqual({ pagina: true, pixel: true });
    expect(blocosDoFacebook(null, '/settings/facebook')).toEqual({ pagina: true, pixel: false });
  });

  it('com as duas telas: Página em cima, Pixel embaixo; no endereço da Página não rola', () => {
    abrir('/settings/facebook', secoes(['/settings/facebook', '/settings/pixel-capi']));
    const textos = screen.getAllByText(/painel da página|configuração do pixel/).map(e => e.textContent);
    expect(textos).toEqual(['painel da página', 'configuração do pixel']);
    expect(rolar).not.toHaveBeenCalled();
  });

  it('no endereço do Pixel, com a Página em cima, abre rolado até o Pixel', () => {
    abrir('/settings/pixel-capi', secoes(['/settings/facebook', '/settings/pixel-capi']));
    expect(rolar).toHaveBeenCalled();
    expect(rolar.mock.contexts[0]).toBe(screen.getByRole('region', { name: 'Pixel' }));
  });

  it('só com o Pixel: só o bloco do Pixel, sem rolar', () => {
    abrir('/settings/pixel-capi', secoes(['/settings/pixel-capi']));
    expect(screen.queryByText('painel da página')).toBeNull();
    expect(screen.getByText('configuração do pixel')).toBeInTheDocument();
    expect(rolar).not.toHaveBeenCalled();
  });

  it('do Pixel para a Página, com a mesma tela montada, volta ao topo', () => {
    const topo = vi.fn();
    Element.prototype.scrollTo = topo as unknown as typeof Element.prototype.scrollTo;
    let ir: (to: string) => void = () => {};
    const Ponte = () => { ir = useNavigate(); return null; };
    render(
      <MemoryRouter initialEntries={['/settings/pixel-capi']}>
        <MenuProvider value={secoes(['/settings/facebook', '/settings/pixel-capi'])}><Ponte /><FacebookIntegracao /></MenuProvider>
      </MemoryRouter>,
    );
    expect(topo).not.toHaveBeenCalled();
    act(() => ir('/settings/facebook'));
    expect(topo).toHaveBeenCalledWith(0, 0);
  });
});
