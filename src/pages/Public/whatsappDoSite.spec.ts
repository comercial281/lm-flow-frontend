import { describe, expect, it } from 'vitest';
import { enderecoDaPagina, linkDoWhatsAppCom, mensagemDoImovel, mensagemDoSite, ondeDoSite } from './whatsappDoSite';

// As frases são lidas pelo servidor (Whatsapp::SiteReferral, backend): mudou
// aqui, muda lá.
describe('whatsappDoSite', () => {
  it('frase do imóvel: link na primeira linha, linha em branco e a frase de sempre', () => {
    expect(mensagemDoImovel('https://www.x.com.br/imovel/apto-205', '205', 'Apartamento no Imirim'))
      .toBe('https://www.x.com.br/imovel/apto-205\n\nOlá! Tenho interesse no imóvel 205 — Apartamento no Imirim.');
  });

  it('frase das outras páginas', () => {
    expect(mensagemDoSite('www.x.com.br'))
      .toBe('Olá! Vim pelo site www.x.com.br e quero saber mais sobre os imóveis disponíveis.');
  });

  it('endereço da página sem a query nem o hash (finalidade, prévia)', () => {
    const u = new URL('https://www.x.com.br/imovel/205?finalidade=locacao&previa=t#fotos');
    expect(enderecoDaPagina(u.origin, u.pathname)).toBe('https://www.x.com.br/imovel/205');
  });

  it('onde: o domínio no domínio próprio; senão o nome do site; sem nome, o endereço', () => {
    expect(ondeDoSite({ name: 'Moeda Forte' }, true, 'www.x.com.br')).toBe('www.x.com.br');
    expect(ondeDoSite({ name: 'Moeda Forte' }, false, 'app.lmflow.com.br')).toBe('Moeda Forte');
    expect(ondeDoSite({ name: '  ' }, false, 'app.lmflow.com.br')).toBe('app.lmflow.com.br');
  });

  it('link do WhatsApp com o texto; sem número, nada', () => {
    expect(linkDoWhatsAppCom('+55 (11) 98888-7777', 'Olá! a&b'))
      .toBe('https://wa.me/5511988887777?text=Ol%C3%A1!%20a%26b');
    expect(linkDoWhatsAppCom(null, 'x')).toBeNull();
    expect(linkDoWhatsAppCom('', 'x')).toBeNull();
  });
});
