import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIconeDaAba } from './useIconeDaAba';

const icones = () => Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));

function ponhaOsDoLmFlow() {
  document.head.innerHTML = `
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />`;
}

describe('useIconeDaAba', () => {
  afterEach(() => { document.head.innerHTML = ''; });

  it('troca todos os ícones da página pelo do site e devolve ao sair', () => {
    ponhaOsDoLmFlow();
    const { unmount } = renderHook(() => useIconeDaAba('https://cdn/icone.png'));
    expect(icones().map(l => l.getAttribute('href'))).toEqual(['https://cdn/icone.png', 'https://cdn/icone.png']);
    expect(icones().some(l => l.hasAttribute('type') || l.hasAttribute('sizes'))).toBe(false);

    unmount();
    expect(icones().map(l => l.getAttribute('href'))).toEqual(['/favicon.ico', '/favicon-32.png']);
    expect(icones()[0].getAttribute('sizes')).toBe('any');
    expect(icones()[1].getAttribute('type')).toBe('image/png');
    expect(icones()[1].getAttribute('sizes')).toBe('32x32');
  });

  it('sem ícone no <head>, cria um e tira ao sair', () => {
    const { unmount } = renderHook(() => useIconeDaAba('https://cdn/icone.png'));
    expect(icones()).toHaveLength(1);
    expect(icones()[0].getAttribute('href')).toBe('https://cdn/icone.png');
    unmount();
    expect(icones()).toHaveLength(0);
  });

  it('acompanha a troca do endereço', () => {
    ponhaOsDoLmFlow();
    const { rerender, unmount } = renderHook(({ url }) => useIconeDaAba(url), { initialProps: { url: 'https://cdn/a.png' } });
    rerender({ url: 'https://cdn/b.svg' });
    expect(icones().every(l => l.getAttribute('href') === 'https://cdn/b.svg')).toBe(true);
    unmount();
    expect(icones()[0].getAttribute('href')).toBe('/favicon.ico');
  });

  it('ignora endereço que não é http(s) e vazio', () => {
    ponhaOsDoLmFlow();
    for (const url of ['javascript:alert(1)', 'data:image/png;base64,AAAA', '/relativo.png', '', null, undefined]) {
      const { unmount } = renderHook(() => useIconeDaAba(url));
      expect(icones().map(l => l.getAttribute('href'))).toEqual(['/favicon.ico', '/favicon-32.png']);
      unmount();
    }
  });
});
