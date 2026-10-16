import { describe, expect, it } from 'vitest';
import { destinoDoPino, localDoPino, paginaNoSite, posicaoDoCardNoMapa } from './pinoDoMapa';

const base = { origem: 'https://app.lmflow.com.br', slug: 'barones' };

describe('destinoDoPino', () => {
  it('no site: abre a página do site, mesmo pra quem pode editar', () => {
    expect(destinoDoPino({ id: '1', code: 'AP1', published_on_site: true }, { ...base, podeEditar: true }))
      .toEqual({ tipo: 'site', endereco: 'https://app.lmflow.com.br/imovel/barones/AP1', texto: 'Ver página no site' });
  });

  it('fora do site e pode editar: abre o cadastro', () => {
    expect(destinoDoPino({ id: '1', code: 'AP1', published_on_site: false }, { ...base, podeEditar: true }))
      .toEqual({ tipo: 'cadastro', endereco: '/properties/1/editar', texto: 'Abrir cadastro' });
  });

  it('fora do site e sem poder editar: não abre nada', () => {
    expect(destinoDoPino({ id: '1', code: 'AP1', published_on_site: false }, { ...base, podeEditar: false })).toBeNull();
  });

  it('servidor antigo (sem a marcação) conta como fora do site', () => {
    expect(destinoDoPino({ id: '1', code: 'AP1' }, { ...base, podeEditar: false })).toBeNull();
  });

  it('sem o endereço do site (sem slug) cai no cadastro', () => {
    expect(destinoDoPino({ id: '1', code: 'AP1', published_on_site: true }, { ...base, slug: null, podeEditar: true })?.tipo)
      .toBe('cadastro');
  });
});

describe('paginaNoSite e localDoPino', () => {
  it('monta a página pública do imóvel', () => {
    expect(paginaNoSite('https://x.com', 'mqi', 'CA9')).toBe('https://x.com/imovel/mqi/CA9');
  });
  it('junta bairro e cidade, e some sem nenhum', () => {
    expect(localDoPino({ neighborhood: 'Mooca', city: 'São Paulo' })).toBe('Mooca, São Paulo');
    expect(localDoPino({ city: 'Santos' })).toBe('Santos');
    expect(localDoPino({})).toBeNull();
  });
});

describe('posicaoDoCardNoMapa', () => {
  const tela = { largura: 1200, altura: 800 };
  const card = { largura: 272, altura: 300 };

  it('abre em cima do alfinete, centrado', () => {
    const p = posicaoDoCardNoMapa({ left: 500, right: 532, top: 400, bottom: 432 }, tela, card);
    expect(p).toEqual({ left: 516 - 136, top: 400 - 8 - 300, lado: 'cima' });
  });

  it('sem espaço em cima, abre embaixo', () => {
    const p = posicaoDoCardNoMapa({ left: 500, right: 532, top: 120, bottom: 152 }, tela, card);
    expect(p.lado).toBe('baixo');
    expect(p.top).toBe(160);
  });

  it('não sai pela lateral da tela', () => {
    expect(posicaoDoCardNoMapa({ left: 0, right: 32, top: 400, bottom: 432 }, tela, card).left).toBe(8);
    expect(posicaoDoCardNoMapa({ left: 1180, right: 1200, top: 400, bottom: 432 }, tela, card).left).toBe(1200 - 272 - 8);
  });
});
