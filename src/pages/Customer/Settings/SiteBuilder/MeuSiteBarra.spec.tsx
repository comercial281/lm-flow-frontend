import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MeuSiteBarra from './MeuSiteBarra';

// A lista suspensa é Radix: abre no pointerdown, que o fireEvent.click do jsdom
// não produz. O userEvent simula o ponteiro inteiro (mesmo padrão de Lembretes).

const base = { tela: 'painel' as const, enderecoVisivel: 'imob.lmflow.com.br/portal/imob',
  urlDoSite: 'https://imob.lmflow.com.br/portal/imob', noAr: true, podeAnuncios: false };

describe('MeuSiteBarra', () => {
  it('mostra endereço, selo e Ver site', () => {
    render(<MeuSiteBarra {...base} aoIr={vi.fn()} />);
    expect(screen.getByText('imob.lmflow.com.br/portal/imob')).toBeTruthy();
    expect(screen.getByText('No ar')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Ver site/ }).getAttribute('href')).toBe(base.urlDoSite);
  });

  it('fora do ar mostra o selo certo', () => {
    render(<MeuSiteBarra {...base} noAr={false} aoIr={vi.fn()} />);
    expect(screen.getByText('Fora do ar')).toBeTruthy();
  });

  it('abre a lista suspensa e navega', async () => {
    const aoIr = vi.fn();
    render(<MeuSiteBarra {...base} aoIr={aoIr} />);
    await userEvent.click(screen.getByRole('button', { name: /Configurações/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Marca d'água/ }));
    expect(aoIr).toHaveBeenCalledWith('marca');
  });

  it('Painel navega direto, sem lista', async () => {
    const aoIr = vi.fn();
    render(<MeuSiteBarra {...base} tela="marca" aoIr={aoIr} />);
    await userEvent.click(screen.getByRole('button', { name: 'Painel' }));
    expect(aoIr).toHaveBeenCalledWith('painel');
  });

  it('sem a chave de páginas de anúncio o item não aparece', async () => {
    render(<MeuSiteBarra {...base} aoIr={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Marketing/ }));
    expect(await screen.findByRole('menuitem', { name: /Blog/ })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /Páginas de anúncio/ })).toBeNull();
  });

  it('com a chave o item de páginas de anúncio aparece', async () => {
    render(<MeuSiteBarra {...base} podeAnuncios aoIr={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Marketing/ }));
    expect(await screen.findByRole('menuitem', { name: /Páginas de anúncio/ })).toBeTruthy();
  });
});
