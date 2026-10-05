import { afterEach, describe, expect, it } from 'vitest';
import { semInstalarApp } from './semInstalarApp';

describe('semInstalarApp', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('tira o manifest e as metas de instalação do PWA, e deixa o resto', () => {
    document.head.innerHTML = `
      <meta name="robots" content="noindex" />
      <link rel="manifest" href="/manifest.json" />
      <link rel="icon" href="/favicon.ico" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="LM Flow" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="application-name" content="LM Flow" />
      <title>Imob</title>`;
    semInstalarApp();
    expect(document.head.querySelector('link[rel="manifest"]')).toBeNull();
    expect(document.head.querySelectorAll('meta[name^="apple-mobile-web-app-"]')).toHaveLength(0);
    expect(document.head.querySelector('meta[name="mobile-web-app-capable"]')).toBeNull();
    expect(document.head.querySelector('meta[name="application-name"]')).toBeNull();
    expect(document.head.querySelector('link[rel="icon"]')).not.toBeNull();
    expect(document.head.querySelector('meta[name="robots"]')).not.toBeNull();
    expect(document.title).toBe('Imob');
  });

  it('head já limpo (o middleware tirou): não quebra', () => {
    document.head.innerHTML = '<title>Imob</title>';
    expect(() => semInstalarApp()).not.toThrow();
  });
});
