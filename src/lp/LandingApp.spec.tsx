import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Landing de anúncio no domínio do cliente (/lp/<slug>): o cliente vem do
// `resolve` do domínio. Falha de rede nele não pode afirmar que a página não
// existe: mostra "Tentar de novo", igual ao site.

const estado = vi.hoisted(() => ({ atual: { tipo: 'erro' } as { tipo: string; site?: { tenant: string; slug: string; host: string } } }));

vi.mock('@/features/siteBuilder/public/dominioDoSite', async importOriginal => ({
  ...(await importOriginal<typeof import('@/features/siteBuilder/public/dominioDoSite')>()),
  ehEnderecoDoSistema: () => false,
  dominioDoSite: async () => estado.atual,
}));
vi.mock('@/features/landing/public/LandingPublicView', () => ({
  LandingPublicView: ({ tenant, slug }: { tenant: string; slug: string }) => <p>landing {tenant}/{slug}</p>,
}));
vi.mock('@/features/landing/public/LandingResultView', () => ({ LandingResultView: () => <p>resultado</p> }));

import { LandingApp } from './LandingApp';

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('landing no domínio do cliente', () => {
  it('falha de rede no resolve: "Não deu para abrir a página agora" com Tentar de novo, que recarrega', async () => {
    estado.atual = { tipo: 'erro' };
    window.history.replaceState({}, '', '/lp/oferta');
    const recarregar = vi.fn();
    vi.stubGlobal('location', { ...window.location, pathname: '/lp/oferta', reload: recarregar });
    render(<LandingApp />);
    expect(await screen.findByText('Não deu para abrir a página agora')).toBeTruthy();
    expect(screen.queryByText('Esta página não está disponível.')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(recarregar).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('domínio sem site ativo (404): segue "Esta página não está disponível.", sem botão', async () => {
    estado.atual = { tipo: 'nao-encontrado' };
    window.history.replaceState({}, '', '/lp/oferta');
    render(<LandingApp />);
    expect(await screen.findByText('Esta página não está disponível.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
  });

  it('domínio com site: monta a landing do cliente do domínio', async () => {
    estado.atual = { tipo: 'site', site: { tenant: 'imob', slug: 'imob', host: 'www.imob.com.br' } };
    window.history.replaceState({}, '', '/lp/oferta');
    render(<LandingApp />);
    expect(await screen.findByText('landing imob/oferta')).toBeTruthy();
  });
});
