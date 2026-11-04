import { afterEach, describe, expect, it } from 'vitest';
import { tirarTextoDoServidorQuandoPronto } from './textoDoServidor';

const espera = () => new Promise(r => setTimeout(r, 0));

describe('tirarTextoDoServidorQuandoPronto', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('sem #lmf-ssr não faz nada', () => {
    document.body.innerHTML = '<div id="root"></div>';
    expect(() => tirarTextoDoServidorQuandoPronto()()).not.toThrow();
  });

  it('mantém o texto enquanto o app não desenhou nada ou está carregando, e tira quando a página aparece', async () => {
    document.body.innerHTML = '<div id="lmf-ssr"><h1>Casa</h1></div><div id="root"></div>';
    tirarTextoDoServidorQuandoPronto();
    const raiz = document.getElementById('root')!;

    raiz.innerHTML = '<div data-carregando>Carregando…</div>';
    await espera();
    expect(document.getElementById('lmf-ssr')).not.toBeNull();

    raiz.innerHTML = '<main><h1>Casa</h1></main>';
    await espera();
    expect(document.getElementById('lmf-ssr')).toBeNull();
  });

  it('tira na hora se o app já está desenhado', () => {
    document.body.innerHTML = '<div id="lmf-ssr">x</div><div id="root"><main>y</main></div>';
    tirarTextoDoServidorQuandoPronto();
    expect(document.getElementById('lmf-ssr')).toBeNull();
  });

  it('o atributo data-carregando saindo do elemento também conta', async () => {
    document.body.innerHTML = '<div id="lmf-ssr">x</div><div id="root"><div id="a" data-carregando>…</div></div>';
    tirarTextoDoServidorQuandoPronto();
    document.getElementById('a')!.removeAttribute('data-carregando');
    await espera();
    expect(document.getElementById('lmf-ssr')).toBeNull();
  });
});
