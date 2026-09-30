import { describe, expect, it } from 'vitest';
import i18next from 'i18next';

import customAttributes from './locales/pt-BR/customAttributes.json';
import labels from './locales/pt-BR/labels.json';
import macros from './locales/pt-BR/macros.json';

// Chaves que já eram divididas na main (antes da Fase 3): ficam como estavam.
const NA_MAIN = [
  'aiAgents.json:subAgents.selectedCount_other',
  'aiAgents.json:dialogs.toolsDialog.addTools_other',
  'auth.json:auth.mfa.remainingAttempts_other',
  'cannedResponses.json:header.selected_other',
  'channels.json:settings.collaborators.agents.selectedCount_other',
  'common.json:base.header.selected_other',
  'contacts.json:export.filters.title_other',
  'contacts.json:export.fields.selected_other',
  'contacts.json:header.selected_other',
  'contacts.json:startConversation.pipelines.morePipelines_other',
];

const jsons = import.meta.glob<Record<string, unknown>>('./locales/pt-BR/*.json', {
  eager: true,
  import: 'default',
});
const naMain = new Set(NA_MAIN);

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

  it('etiquetas: 0 etiquetas, 1 etiqueta, 2 etiquetas', async () => {
    const i18n = await carregar({ labels });
    expect(i18n.t('labels:header.subtitle', { count: 0 })).toBe('0 etiquetas no total');
    expect(i18n.t('labels:header.subtitle', { count: 1 })).toBe('1 etiqueta no total');
    expect(i18n.t('labels:header.subtitle', { count: 2 })).toBe('2 etiquetas no total');
  });

  it('macros: 0 macros, 1 macro, 2 macros', async () => {
    const i18n = await carregar({ macros });
    expect(i18n.t('macros:header.subtitle', { count: 0 })).toBe('0 macros no total');
    expect(i18n.t('macros:header.subtitle', { count: 1 })).toBe('1 macro no total');
    expect(i18n.t('macros:header.subtitle', { count: 2 })).toBe('2 macros no total');
  });

  it('toda chave dividida na Fase 3 que mostra {{count}} tem a `_zero` igual à `_other`', () => {
    const faltando: string[] = [];
    const visitar = (arquivo: string, obj: Record<string, unknown>, prefixo = '') => {
      for (const [chave, valor] of Object.entries(obj)) {
        const caminho = `${prefixo}${chave}`;
        if (valor && typeof valor === 'object') {
          visitar(arquivo, valor as Record<string, unknown>, `${caminho}.`);
        } else if (chave.endsWith('_other') && typeof valor === 'string' && valor.includes('{{count}}')) {
          const id = `${arquivo}:${caminho}`;
          if (naMain.has(id)) continue;
          if (obj[`${chave.slice(0, -6)}_zero`] !== valor) faltando.push(id);
        }
      }
    };
    for (const [caminho, dados] of Object.entries(jsons)) {
      visitar(caminho.replace('./locales/pt-BR/', ''), dados);
    }
    expect(faltando).toEqual([]);
  });
});
