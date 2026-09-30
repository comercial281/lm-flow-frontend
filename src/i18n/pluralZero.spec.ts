import { describe, expect, it } from 'vitest';
import i18next from 'i18next';

import customAttributes from './locales/pt-BR/customAttributes.json';

// No pt-BR o i18next trata 0 como singular ("0 etiqueta no total"). Quem
// mostra "0 etiquetas" é a chave `_zero`, que o i18next 25 procura antes da
// forma do idioma quando count é 0. Toda chave dividida em base + `_other`
// que mostra {{count}} ganha a `_zero` com a forma plural.
async function carregar(resources: Record<string, Record<string, unknown>>) {
  const i18n = i18next.createInstance();
  await i18n.init({
    lng: 'pt-BR',
    fallbackLng: 'pt-BR',
    resources: { 'pt-BR': resources },
    interpolation: { escapeValue: false },
    keySeparator: '.',
    nsSeparator: ':',
  });
  return i18n;
}

describe('zero no plural (pt-BR)', () => {
  it('o i18next 25 trata 0 como singular sem `_zero` e usa a `_zero` quando existe', async () => {
    const i18n = await carregar({
      sem: { s: '{{count}} etiqueta no total', s_other: '{{count}} etiquetas no total' },
      com: {
        s: '{{count}} etiqueta no total',
        s_zero: '{{count}} etiquetas no total',
        s_other: '{{count}} etiquetas no total',
      },
    });
    expect(i18n.t('sem:s', { count: 0 })).toBe('0 etiqueta no total');
    expect(i18n.t('com:s', { count: 0 })).toBe('0 etiquetas no total');
    expect(i18n.t('com:s', { count: 1 })).toBe('1 etiqueta no total');
    expect(i18n.t('com:s', { count: 2 })).toBe('2 etiquetas no total');
  });

  it('atributos personalizados: 0 atributos, 1 atributo, 2 atributos', async () => {
    const i18n = await carregar({ customAttributes });
    const total = (count: number) =>
      i18n.t('customAttributes:header.subtitle', { count, tabName: 'de contato' });
    expect(total(0)).toBe('0 atributos de contato no total');
    expect(total(1)).toBe('1 atributo de contato no total');
    expect(total(2)).toBe('2 atributos de contato no total');
  });
});
