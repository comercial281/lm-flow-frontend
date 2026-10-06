import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CHAVE_DO_MODELO, comModeloDaPrevia, ehPreviaDoModelo, esquecerModeloDaPrevia, modeloDaPrevia,
} from './previaDoModelo';
import { resolverAparencia } from './aparenciaConfig';
import { resolverHome } from './homeConfig';
import { resolverLista } from './listaConfig';

const limpar = () => {
  sessionStorage.clear();
  esquecerModeloDaPrevia();
  window.history.replaceState({}, '', '/');
};

describe('prévia do modelo (?modelo= → sessionStorage)', () => {
  beforeEach(limpar);
  afterEach(limpar);

  it('lê o ?modelo= da URL e guarda em sessionStorage["lmf-modelo"]', () => {
    expect(modeloDaPrevia({ search: '?modelo=editorial' })).toBe('editorial');
    expect(sessionStorage.getItem(CHAVE_DO_MODELO)).toBe('editorial');
  });

  it('convive com o ?previa= na mesma URL', () => {
    expect(modeloDaPrevia({ search: '?previa=tok-1&modelo=popular' })).toBe('popular');
  });

  it('valor fora da lista é null (e não é guardado)', () => {
    expect(modeloDaPrevia({ search: '?modelo=moderno' })).toBeNull();
    expect(sessionStorage.getItem(CHAVE_DO_MODELO)).toBeNull();
  });

  it('sem ?modelo= e sem nada guardado, null', () => {
    expect(modeloDaPrevia({ search: '' })).toBeNull();
  });

  it('depois que a URL perde o ?modelo= (navegação interna), segue com o guardado', () => {
    modeloDaPrevia({ search: '?modelo=popular' });
    expect(modeloDaPrevia({ search: '?tab=sale' })).toBe('popular');
  });

  it('o guardado adulterado vale como nada', () => {
    sessionStorage.setItem(CHAVE_DO_MODELO, 'qualquer');
    expect(modeloDaPrevia({ search: '' })).toBeNull();
  });
});

describe('comModeloDaPrevia', () => {
  beforeEach(limpar);
  afterEach(limpar);

  const SITE = {
    name: 'Imob',
    branding: { logo_url: 'https://cdn/logo.png', primary_color: '#123456', accent_color: '#ABCDEF', font_family: 'Inter' },
    appearance: { logo_light_url: 'https://cdn/clara.png', footer_text: 'Frase minha' },
    home: { search: { title: 'Meu título' } },
    listing: { default_sort: 'price_asc' },
  };

  it('sem modelo devolve o MESMO objeto (o site normal sai idêntico)', () => {
    expect(comModeloDaPrevia(SITE)).toBe(SITE);
  });

  it('com popular: topo na cor da marca, passo a passo ligado, fonte Poppins e a marca da prévia', () => {
    window.history.replaceState({}, '', '/portal/imob?modelo=popular');
    const s = comModeloDaPrevia(SITE);
    expect(s).not.toBe(SITE);
    expect(s.modelo_em_previa).toBe('popular');
    expect(resolverAparencia(s.appearance).header_style).toBe('brand');
    expect(resolverHome(s.home).steps.enabled).toBe(true);
    expect(s.branding?.font_family).toBe('Poppins');
  });

  it('preserva logo, cores e o que o modelo não toca', () => {
    window.history.replaceState({}, '', '/portal/imob?modelo=editorial');
    const s = comModeloDaPrevia(SITE);
    expect(s.branding?.logo_url).toBe('https://cdn/logo.png');
    expect(s.branding?.primary_color).toBe('#123456');
    expect(s.branding?.accent_color).toBe('#ABCDEF');
    expect(s.name).toBe('Imob');
    const ap = resolverAparencia(s.appearance);
    expect(ap.background).toBe('dark');
    expect(ap.logo_light_url).toBe('https://cdn/clara.png');
    expect(ap.footer_text).toBe('Frase minha');
    expect(resolverHome(s.home).search.title).toBe('Meu título');
    const lista = resolverLista(s.listing);
    expect(lista.card_layout).toBe('rows');
    expect(lista.default_sort).toBe('price_asc');
    // O original não é mexido.
    expect(SITE.branding.font_family).toBe('Inter');
  });

  it('ehPreviaDoModelo: só com a marca de um modelo', () => {
    expect(ehPreviaDoModelo({ modelo_em_previa: 'editorial' })).toBe(true);
    expect(ehPreviaDoModelo({})).toBe(false);
    expect(ehPreviaDoModelo(null)).toBe(false);
  });
});
