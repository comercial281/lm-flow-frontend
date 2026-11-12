import { describe, expect, it } from 'vitest';
import { landingPublicUrl } from './landingUrl';

const local = (origem: string) => {
  const u = new URL(origem);
  return { hostname: u.hostname, origin: u.origin };
};

describe('landingPublicUrl', () => {
  it('no endereço do cliente: o mesmo link de sempre', () => {
    expect(landingPublicUrl('016-imoveis', 'oferta', local('https://016-imoveis.lmflow.com.br')))
      .toBe('https://016-imoveis.lmflow.com.br/lp/016-imoveis/oferta');
  });

  it('em outro endereço lmflow: já sai o endereço do cliente', () => {
    expect(landingPublicUrl('nova-27', 'oferta', local('https://app.lmflow.com.br')))
      .toBe('https://nova-27.lmflow.com.br/lp/nova-27/oferta');
  });

  it('local e prévia: o endereço aberto, como antes', () => {
    expect(landingPublicUrl('imob', 'oferta', local('http://localhost:5173'))).toBe('http://localhost:5173/lp/imob/oferta');
    expect(landingPublicUrl('imob', 'oferta', local('https://x.vercel.app'))).toBe('https://x.vercel.app/lp/imob/oferta');
  });
});
