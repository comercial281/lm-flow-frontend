import { describe, expect, it } from 'vitest';
import {
  APARENCIA_FABRICA, DEGRADE_DA_CAPA_FABRICA, FONTES_DO_SITE, TINTA_ESCURA,
  clarearAte, contrasteEntre, filtroDaCapa, fonteDoSite, fontesDoSite, logoNaSuperficie, resolverAparencia, textoSobre,
} from './aparenciaConfig';

describe('resolverAparencia', () => {
  it('servidor velho (sem appearance), nulo ou lixo: o padrão de fábrica', () => {
    for (const raw of [undefined, null, 'x', 42, [], {}]) {
      expect(resolverAparencia(raw)).toEqual(APARENCIA_FABRICA);
    }
    expect(APARENCIA_FABRICA).toEqual({
      background: 'light', header_style: 'transparent', logo_light_url: null, top_bar: 'two_phones',
      hero_height: 'half', hero_overlay: 45, footer_layout: 'columns', footer_text: null,
      heading_font: null, menu_style: 'normal', hero_layout: 'photo', card_style: 'standard',
    });
  });

  it('valor fora da lista cai no de fábrica, campo a campo', () => {
    expect(resolverAparencia({ background: 'roxo', header_style: 'dark', top_bar: 'three', hero_height: 'tall', footer_layout: 'grid', header_extra: 1 }))
      .toEqual(APARENCIA_FABRICA);
    expect(resolverAparencia({ heading_font: 'Comic Sans', menu_style: 'small', hero_layout: 'video', card_style: 'huge' }))
      .toEqual(APARENCIA_FABRICA);
    expect(resolverAparencia({ heading_font: 42 }).heading_font).toBeNull();
  });

  it('aceita cada opção válida', () => {
    const ap = resolverAparencia({
      background: 'dark', header_style: 'brand', logo_light_url: ' https://cdn.x/clara.png ', top_bar: 'icons',
      hero_height: 'full', hero_overlay: 60, footer_layout: 'compact', footer_text: '  Imóveis em Campinas desde 1990.  ',
      heading_font: 'Playfair Display', menu_style: 'caps', hero_layout: 'split', card_style: 'large',
    });
    expect(ap).toEqual({
      background: 'dark', header_style: 'brand', logo_light_url: 'https://cdn.x/clara.png', top_bar: 'icons',
      hero_height: 'full', hero_overlay: 60, footer_layout: 'compact', footer_text: 'Imóveis em Campinas desde 1990.',
      heading_font: 'Playfair Display', menu_style: 'caps', hero_layout: 'split', card_style: 'large',
    });
  });

  it('filtro fica entre 0 e 80, inteiro; texto ou NaN volta pro 45', () => {
    expect(resolverAparencia({ hero_overlay: -10 }).hero_overlay).toBe(0);
    expect(resolverAparencia({ hero_overlay: 200 }).hero_overlay).toBe(80);
    expect(resolverAparencia({ hero_overlay: 33.6 }).hero_overlay).toBe(34);
    expect(resolverAparencia({ hero_overlay: '60' }).hero_overlay).toBe(45);
    expect(resolverAparencia({ hero_overlay: Number.NaN }).hero_overlay).toBe(45);
  });

  it('logo clara só com endereço http(s)', () => {
    expect(resolverAparencia({ logo_light_url: 'javascript:alert(1)' }).logo_light_url).toBeNull();
    expect(resolverAparencia({ logo_light_url: 'data:image/png;base64,xx' }).logo_light_url).toBeNull();
    expect(resolverAparencia({ logo_light_url: '' }).logo_light_url).toBeNull();
    expect(resolverAparencia({ logo_light_url: 'http://cdn.x/a.png' }).logo_light_url).toBe('http://cdn.x/a.png');
  });

  it('texto do rodapé: em branco vira nulo (a frase de fábrica) e o teto é 200', () => {
    expect(resolverAparencia({ footer_text: '   ' }).footer_text).toBeNull();
    expect(resolverAparencia({ footer_text: 'a'.repeat(250) }).footer_text).toHaveLength(200);
    // Corta por caractere: 199 letras + 2 emojis = 200 caracteres com o 1º emoji inteiro.
    const comEmoji = resolverAparencia({ footer_text: `${'a'.repeat(199)}🏠🏠` }).footer_text!;
    expect(comEmoji).toBe(`${'a'.repeat(199)}🏠`);
    expect([...comEmoji]).toHaveLength(200);
  });
});

describe('filtroDaCapa', () => {
  it('45 (fábrica) é exatamente o degradê de antes', () => {
    expect(filtroDaCapa(45)).toBe(DEGRADE_DA_CAPA_FABRICA);
    expect(DEGRADE_DA_CAPA_FABRICA).toBe('linear-gradient(180deg, rgba(23,20,15,0.35) 0%, rgba(23,20,15,0.55) 55%, var(--paper) 100%)');
  });

  it('topo = (o − 10)/100 e meio = (o + 10)/100, presos entre 0 e 0,9; o pé fica no fundo do site', () => {
    const degrade = (t: string, m: string) => `linear-gradient(180deg, rgba(23,20,15,${t}) 0%, rgba(23,20,15,${m}) 55%, var(--paper) 100%)`;
    expect(filtroDaCapa(0)).toBe(degrade('0', '0.1'));
    expect(filtroDaCapa(5)).toBe(degrade('0', '0.15'));
    expect(filtroDaCapa(60)).toBe(degrade('0.5', '0.7'));
    expect(filtroDaCapa(80)).toBe(degrade('0.7', '0.9'));
    expect(filtroDaCapa(90)).toBe(filtroDaCapa(80));
  });
});

describe('textoSobre', () => {
  it('branco em cor escura, tinta escura em cor clara', () => {
    expect(textoSobre('#0E7C5A')).toBe('#FFFFFF');
    expect(textoSobre('#9333EA')).toBe('#FFFFFF');
    expect(textoSobre('#FACC15')).toBe(TINTA_ESCURA);
    expect(textoSobre('#fff')).toBe(TINTA_ESCURA);
  });
  it('cor que não é hexadecimal fica com branco, como sempre', () => {
    expect(textoSobre('rebeccapurple')).toBe('#FFFFFF');
    expect(textoSobre(null)).toBe('#FFFFFF');
  });
});

describe('fonteDoSite', () => {
  it('são 10 fontes, com as 4 novas', () => {
    expect(FONTES_DO_SITE).toHaveLength(10);
    expect(FONTES_DO_SITE).toEqual(expect.arrayContaining(['DM Sans', 'Playfair Display', 'Nunito', 'Raleway']));
  });

  it('cada fonte sai com o endereço do Google Fonts no mesmo formato das de antes', () => {
    for (const f of FONTES_DO_SITE) {
      expect(fonteDoSite(f).fontHref).toBe(`https://fonts.googleapis.com/css2?family=${f.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`);
    }
  });

  it('sem fonte, Inter; a de serifa tem reserva com serifa', () => {
    expect(fonteDoSite(null)).toEqual({
      font: 'Inter', fontStack: 'Inter, system-ui, sans-serif',
      fontHref: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    });
    expect(fonteDoSite('Playfair Display').fontStack).toBe('Playfair Display, Georgia, serif');
    expect(fonteDoSite('Raleway').fontStack).toBe('Raleway, system-ui, sans-serif');
  });
});

describe('fontesDoSite (fonte dos títulos)', () => {
  const href = (f: string) => fonteDoSite(f).fontHref;

  it('sem fonte dos títulos: o mesmo que fonteDoSite, um endereço e os títulos na fonte do corpo', () => {
    for (const titulos of [null, undefined, '']) {
      expect(fontesDoSite('Montserrat', titulos)).toEqual({
        fontStack: 'Montserrat, system-ui, sans-serif', displayStack: 'Montserrat, system-ui, sans-serif', hrefs: [href('Montserrat')],
      });
    }
    expect(fontesDoSite(null, null)).toEqual({ fontStack: fonteDoSite(null).fontStack, displayStack: fonteDoSite(null).fontStack, hrefs: [href('Inter')] });
  });

  it('fonte dos títulos diferente: dois endereços (corpo primeiro) e os títulos com a reserva certa', () => {
    expect(fontesDoSite('DM Sans', 'Playfair Display')).toEqual({
      fontStack: 'DM Sans, system-ui, sans-serif', displayStack: 'Playfair Display, Georgia, serif',
      hrefs: [href('DM Sans'), href('Playfair Display')],
    });
  });

  it('a mesma fonte nos dois: um endereço só', () => {
    expect(fontesDoSite('Raleway', 'Raleway').hrefs).toEqual([href('Raleway')]);
    // Sem fonte do corpo, o corpo é Inter: título Inter também é um endereço só.
    expect(fontesDoSite(null, 'Inter').hrefs).toEqual([href('Inter')]);
  });
});

describe('logoNaSuperficie', () => {
  const comClara = { ...APARENCIA_FABRICA, logo_light_url: 'https://cdn.x/clara.png' };

  it('a clara vai na foto da capa e na cor principal', () => {
    expect(logoNaSuperficie('https://cdn.x/logo.png', comClara, 'foto')).toEqual({ url: 'https://cdn.x/clara.png', clara: true });
    expect(logoNaSuperficie('https://cdn.x/logo.png', comClara, 'marca')).toEqual({ url: 'https://cdn.x/clara.png', clara: true });
  });

  it('no branco e no fundo claro, a normal', () => {
    expect(logoNaSuperficie('https://cdn.x/logo.png', comClara, 'branco')).toEqual({ url: 'https://cdn.x/logo.png', clara: false });
    expect(logoNaSuperficie('https://cdn.x/logo.png', comClara, 'fundo')).toEqual({ url: 'https://cdn.x/logo.png', clara: false });
  });

  it('no fundo escuro a clara entra também no topo sólido e no rodapé', () => {
    expect(logoNaSuperficie('https://cdn.x/logo.png', { ...comClara, background: 'dark' }, 'fundo').clara).toBe(true);
    expect(logoNaSuperficie('https://cdn.x/logo.png', { ...comClara, background: 'dark' }, 'branco').clara).toBe(false);
  });

  it('sem logo clara, a normal em todo lugar', () => {
    expect(logoNaSuperficie('https://cdn.x/logo.png', APARENCIA_FABRICA, 'foto')).toEqual({ url: 'https://cdn.x/logo.png', clara: false });
    expect(logoNaSuperficie(null, APARENCIA_FABRICA, 'marca')).toEqual({ url: null, clara: false });
  });
});

describe('clarearAte', () => {
  it.each(['#1E3A8A', '#7C3AED', '#0E7C5A'])('%s clareia até 4,5:1 sobre o fundo escuro', cor => {
    const c = clarearAte(cor, '#14110D');
    expect(contrasteEntre(c, '#14110D')).toBeGreaterThanOrEqual(4.5);
    expect(c).not.toBe(cor);
  });
  it('cor que já dá o contraste volta como está; cor que não é hex vira a tinta clara', () => {
    expect(clarearAte('#FACC15', '#14110D')).toBe('#FACC15');
    expect(clarearAte('rebeccapurple', '#14110D')).toBe('#F4EFE7');
  });
});

describe('logoNaSuperficie na cor principal', () => {
  const comClara = { ...APARENCIA_FABRICA, logo_light_url: 'https://cdn.x/clara.png' };
  it('a clara só quando a cor principal é escura (texto branco)', () => {
    expect(logoNaSuperficie('https://cdn.x/logo.png', comClara, 'marca', '#0E7C5A').clara).toBe(true);
    expect(logoNaSuperficie('https://cdn.x/logo.png', comClara, 'marca', '#FACC15')).toEqual({ url: 'https://cdn.x/logo.png', clara: false });
  });
});
