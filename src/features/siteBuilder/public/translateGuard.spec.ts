import { afterEach, describe, expect, it, vi } from 'vitest';
import { protegerDomDoTradutor } from './translateGuard';

describe('protegerDomDoTradutor', () => {
  afterEach(() => vi.restoreAllMocks());

  it('removeChild/insertBefore com nó que o tradutor tirou do lugar não estoura', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    protegerDomDoTradutor();
    protegerDomDoTradutor(); // instala uma vez só

    const pai = document.createElement('div');
    const texto = document.createTextNode('Olá');
    pai.appendChild(texto);
    // O tradutor do Google troca o nó de texto do React por um <font> próprio.
    const font = document.createElement('font');
    pai.replaceChild(font, texto);
    font.appendChild(texto);

    expect(() => pai.removeChild(texto)).not.toThrow();
    expect(() => pai.insertBefore(document.createElement('span'), texto)).not.toThrow();
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it('o caminho normal segue funcionando', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    protegerDomDoTradutor();
    const pai = document.createElement('div');
    const a = document.createElement('span');
    pai.appendChild(a);
    const b = document.createElement('b');
    pai.insertBefore(b, a);
    expect(pai.firstChild).toBe(b);
    pai.removeChild(a);
    expect(pai.childNodes).toHaveLength(1);
  });
});
