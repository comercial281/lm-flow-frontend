import { describe, expect, it } from 'vitest';
import { aplicarModelo, modeloAtual, MODELOS_DO_SITE, type EstadoDoVisual } from './modelosDoSite';
import { APARENCIA_FABRICA } from './public/aparenciaConfig';
import { HOME_FABRICA, PASSOS_MCMV } from './public/homeConfig';
import { LISTA_FABRICA } from './public/listaConfig';

const personalizado = (): EstadoDoVisual => ({
  font_family: 'Lora',
  appearance: { ...APARENCIA_FABRICA, logo_light_url: 'https://x.com/logo.png', footer_text: 'Frase do cliente', hero_overlay: 60 },
  home: {
    ...HOME_FABRICA,
    search: { ...HOME_FABRICA.search, title: 'Busque aqui' },
    showcases: [{ id: 'c1', kind: 'custom', enabled: true, title: 'Minha vitrine' }],
    callouts: {
      ...HOME_FABRICA.callouts,
      custom: [{ title: 'Própria', text: null, button: null, dest_type: 'url', dest_value: 'https://x.com' }],
    },
  },
  listing: { default_sort: 'price_asc', card_layout: 'grid' },
});

describe('modelosDoSite', () => {
  it('tem os três modelos, com nome e frase', () => {
    expect(MODELOS_DO_SITE.map(m => m.id)).toEqual(['classico', 'editorial', 'popular']);
    MODELOS_DO_SITE.forEach(m => { expect(m.nome).toBeTruthy(); expect(m.frase).toBeTruthy(); });
  });

  it('Editorial muda as chaves da tabela e preserva o resto', () => {
    const antes = personalizado();
    const r = aplicarModelo('editorial', antes);
    expect(r.font_family).toBe('DM Sans');
    expect(r.appearance).toMatchObject({
      heading_font: 'Playfair Display', background: 'dark', header_style: 'transparent', top_bar: 'hidden',
      hero_layout: 'split', hero_height: 'full', menu_style: 'caps', card_style: 'large', footer_layout: 'compact',
    });
    expect(r.listing).toEqual({ default_sort: 'price_asc', card_layout: 'rows' });
    expect(r.home.callouts.layout).toBe('cards');
    expect(r.appearance.logo_light_url).toBe('https://x.com/logo.png');
    expect(r.appearance.footer_text).toBe('Frase do cliente');
    expect(r.appearance.hero_overlay).toBe(60);
    expect(r.home.search).toEqual(antes.home.search);
    expect(r.home.showcases).toEqual(antes.home.showcases);
    expect(r.home.callouts.custom).toEqual(antes.home.callouts.custom);
    expect(r.home.most_searched).toEqual(antes.home.most_searched);
    expect(r.home.steps.enabled).toBe(false);
  });

  it('Editorial liga o Atendimento com os textos de fábrica quando não há título', () => {
    const r = aplicarModelo('editorial', personalizado());
    expect(r.home.about).toMatchObject({
      enabled: true, eyebrow: 'Atendimento', title: 'Do primeiro contato à escritura, com uma pessoa só.',
      text: 'Conte o que você procura. A gente seleciona, acompanha as visitas e cuida da papelada até a entrega das chaves.',
      button_label: 'Agendar uma conversa', button_link: '#contato',
    });
  });

  it('Editorial mantém o texto do cliente quando o Atendimento já tem título (e completa só o vazio)', () => {
    const e = personalizado();
    e.home.about = { ...e.home.about, title: 'Meu título', text: 'Meu texto', eyebrow: null };
    const r = aplicarModelo('editorial', e);
    expect(r.home.about).toMatchObject({
      enabled: true, title: 'Meu título', text: 'Meu texto', eyebrow: 'Atendimento',
      button_label: 'Agendar uma conversa', button_link: '#contato',
    });
  });

  it('Editorial com título vazio preenche só os campos vazios e não apaga o que o cliente escreveu', () => {
    const e = personalizado();
    e.home.about = {
      ...e.home.about, title: '   ', eyebrow: 'Meu selo', text: 'Meu texto', button_label: 'Fale comigo',
      button_link: null, photo_url: 'https://x.com/foto.jpg',
    };
    const r = aplicarModelo('editorial', e);
    expect(r.home.about).toEqual({
      enabled: true, eyebrow: 'Meu selo', title: 'Do primeiro contato à escritura, com uma pessoa só.',
      text: 'Meu texto', photo_url: 'https://x.com/foto.jpg', button_label: 'Fale comigo', button_link: '#contato',
    });
  });

  it('Popular preenche os passos do MCMV quando vazio e mantém os do cliente', () => {
    expect(aplicarModelo('popular', personalizado()).home.steps).toMatchObject({ enabled: true, items: PASSOS_MCMV });
    const e = personalizado();
    e.home.steps = { enabled: false, title: 'Etapas', items: [{ title: 'Um', text: 'a' }] };
    const r = aplicarModelo('popular', e);
    expect(r.home.steps).toEqual({ enabled: true, title: 'Etapas', items: [{ title: 'Um', text: 'a' }] });
    expect(r.appearance).toMatchObject({ header_style: 'brand', hero_layout: 'split', hero_height: 'half', heading_font: null });
    expect(r.font_family).toBe('Poppins');
    expect(r.home.about.enabled).toBe(false);
  });

  it('Clássico volta às chaves de fábrica sem apagar logo clara nem frase do rodapé', () => {
    const e = personalizado();
    e.appearance = { ...e.appearance, background: 'dark', hero_layout: 'split', menu_style: 'caps', heading_font: 'Lora' };
    const r = aplicarModelo('classico', e);
    expect(r.font_family).toBe('Inter');
    expect(r.appearance).toEqual({ ...APARENCIA_FABRICA, logo_light_url: 'https://x.com/logo.png', footer_text: 'Frase do cliente', hero_overlay: 60 });
    expect(r.listing.card_layout).toBe('grid');
    expect(r.home.callouts.layout).toBe('band');
  });

  it('modeloAtual devolve o id quando tudo bate e null quando o cliente mexeu', () => {
    (['classico', 'editorial', 'popular'] as const).forEach(id => {
      expect(modeloAtual(aplicarModelo(id, personalizado()))).toBe(id);
    });
    const r = aplicarModelo('editorial', personalizado());
    expect(modeloAtual({ ...r, appearance: { ...r.appearance, menu_style: 'normal' } })).toBeNull();
    expect(modeloAtual({ ...r, listing: { ...r.listing, card_layout: 'grid' } })).toBeNull();
    expect(modeloAtual({ ...r, font_family: 'Inter' })).toBeNull();
  });

  it('modeloAtual não liga pra cores nem textos', () => {
    const r = aplicarModelo('classico', { font_family: null, appearance: APARENCIA_FABRICA, home: HOME_FABRICA, listing: LISTA_FABRICA });
    expect(modeloAtual({ ...r, appearance: { ...r.appearance, footer_text: 'outro', hero_overlay: 10 } })).toBe('classico');
  });
});
