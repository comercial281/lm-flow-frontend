import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// O pop-up de aceite da roleta tem que estar em QUALQUER tela do app: ele mora
// no layout principal, ao lado da faixa amarela, DENTRO do provider da lista de
// ofertas (fora dele o hook devolve lista vazia e o pop-up nunca abre — falha
// muda). O MainLayout puxa dezenas de contextos; montar tudo aqui para conferir
// duas linhas seria um teste mais frágil que o que ele protege.
describe('MainLayout — ofertas da roleta', () => {
  const fonte = readFileSync(resolve(__dirname, 'MainLayout.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');

  it('monta o pop-up de aceite e a faixa dentro do provider das ofertas', () => {
    const abre = fonte.indexOf('<PendingOffersProvider>');
    const fecha = fonte.indexOf('</PendingOffersProvider>');
    const popup = fonte.indexOf('<OfferPopup />');
    const faixa = fonte.indexOf('<PendingOffersBanner />');

    expect(abre).toBeGreaterThan(-1);
    expect(popup).toBeGreaterThan(abre);
    expect(popup).toBeLessThan(fecha);
    expect(faixa).toBeGreaterThan(abre);
    expect(faixa).toBeLessThan(fecha);
  });
});
