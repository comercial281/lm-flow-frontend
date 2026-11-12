import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Landing no endereço lmflow: só monta no endereço do próprio cliente; nos
// outros vai para o dele (location.replace), com busca e âncora.

vi.mock('@/features/landing/public/LandingPublicView', () => ({
  LandingPublicView: ({ tenant, slug }: { tenant: string; slug: string }) => <p>landing {tenant}/{slug}</p>,
}));
vi.mock('@/features/landing/public/LandingResultView', () => ({
  LandingResultView: ({ tenant, result }: { tenant: string; result: string }) => <p>resultado {tenant}/{result}</p>,
}));

import { LandingApp } from './LandingApp';

function abrir(url: string) {
  const u = new URL(url);
  const replace = vi.fn();
  vi.stubGlobal('location', {
    href: u.href, origin: u.origin, hostname: u.hostname, host: u.host,
    pathname: u.pathname, search: u.search, hash: u.hash, replace,
  });
  render(<LandingApp />);
  return replace;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('landing no endereço lmflow', () => {
  it('no endereço do próprio cliente: monta, sem redirecionar', () => {
    const replace = abrir('https://016-imoveis.lmflow.com.br/lp/016-imoveis/oferta?utm_source=fb');
    expect(screen.getByText('landing 016-imoveis/oferta')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([
    ['https://app.lmflow.com.br'],
    ['https://lmflow.com.br'],
    ['https://outro.lmflow.com.br'],
  ])('em %s: não monta e vai para o endereço do cliente com busca e âncora', (origem) => {
    const replace = abrir(`${origem}/lp/nova-27/oferta?utm_source=fb&fbclid=IwAR0#form`);
    expect(screen.queryByText(/landing/)).toBeNull();
    expect(replace).toHaveBeenCalledWith('https://nova-27.lmflow.com.br/lp/nova-27/oferta?utm_source=fb&fbclid=IwAR0#form');
  });

  it('página de resultado segue a mesma regra', () => {
    const replace = abrir('https://app.lmflow.com.br/lp/nova-27/oferta/obrigado');
    expect(screen.queryByText(/resultado/)).toBeNull();
    expect(replace).toHaveBeenCalledWith('https://nova-27.lmflow.com.br/lp/nova-27/oferta/obrigado');
  });

  it('cliente sem endereço possível: "não disponível", sem redirecionar', () => {
    const replace = abrir('https://app.lmflow.com.br/lp/app/oferta');
    expect(screen.getByText('Esta página não está disponível.')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([
    ['http://localhost:5173'],
    ['https://lm-flow-frontend-git-x.vercel.app'],
  ])('em %s: monta como antes', (origem) => {
    const replace = abrir(`${origem}/lp/imob/oferta`);
    expect(screen.getByText('landing imob/oferta')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
});
