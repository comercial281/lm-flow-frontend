import { describe, it, expect, vi, afterEach } from 'vitest';
import { textoDoHtml, htmlSeguro } from './htmlSeguro';

// Entradas fora da lista permitida: o que entra aqui nunca pode sair na tela.
const FORA_DA_LISTA = [
  '<img src="x" onerror="window.__marca=1">',
  '<p onclick="window.__marca=1">oi</p>',
  '<iframe src="https://exemplo.com"></iframe>',
  '<iframe srcdoc="<p>oi</p>"></iframe>',
  '<a href="javascript:window.__marca=1">link</a>',
  '<a href=" JaVaScRiPt:window.__marca=1">link</a>',
  '<a href="data:text/html,oi">link</a>',
  '<object data="x"></object><embed src="x">',
  '<form action="https://exemplo.com"><input name="a"><button>ok</button></form>',
  '<svg><circle onload="window.__marca=1"></circle></svg>',
  '<math><mi>x</mi></math>',
  '<style>body{display:none}</style><p>oi</p>',
  '<script>window.__marca=1</script><p>oi</p>',
  '<base href="https://exemplo.com"><meta http-equiv="refresh" content="0">',
];

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as Record<string, unknown>).__marca;
});

describe('textoDoHtml', () => {
  it('devolve só o texto, com entidades decodificadas', () => {
    expect(textoDoHtml('<p>Olá <b>mundo</b></p>')).toBe('Olá mundo');
    expect(textoDoHtml('a &amp; b &lt; c')).toBe('a & b < c');
    expect(textoDoHtml('texto puro')).toBe('texto puro');
  });

  it('aceita vazio e nulo', () => {
    expect(textoDoHtml('')).toBe('');
    expect(textoDoHtml(null)).toBe('');
    expect(textoDoHtml(undefined)).toBe('');
  });

  it('ignora cabeçalho, estilo e código de um documento inteiro', () => {
    const doc = '<!DOCTYPE html><html><head><title>T</title><style>p{color:red}</style></head>'
      + '<body><p>Corpo</p><script>var x = 1</script></body></html>';
    expect(textoDoHtml(doc).trim()).toBe('Corpo');
  });

  it('não cria elemento na página nem roda atributo de evento', async () => {
    const criar = vi.spyOn(document, 'createElement');
    for (const entrada of FORA_DA_LISTA) textoDoHtml(entrada);
    expect(criar).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 20));
    expect((window as unknown as Record<string, unknown>).__marca).toBeUndefined();
  });
});

describe('htmlSeguro', () => {
  function montar(html: string): HTMLDivElement {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
  }

  it.each(FORA_DA_LISTA)('tira o que está fora da lista: %s', (entrada) => {
    const saida = htmlSeguro(entrada);
    const div = montar(saida);
    expect(div.querySelector('iframe, object, embed, form, input, button, svg, math, style, script, base, meta')).toBeNull();
    for (const el of Array.from(div.querySelectorAll('*'))) {
      for (const attr of Array.from(el.attributes)) {
        expect(attr.name.startsWith('on')).toBe(false);
        expect(attr.name).not.toBe('srcdoc');
      }
    }
    for (const a of Array.from(div.querySelectorAll('a[href]'))) {
      expect(a.getAttribute('href')).toMatch(/^(https?:|mailto:|tel:|\/|#)/i);
    }
    expect(saida.toLowerCase()).not.toContain('javascript:');
  });

  it('mantém a formatação do editor (negrito, itálico, código, listas, quebras)', () => {
    const html = '<p><strong>Negrito</strong> <em>itálico</em> <code>cod</code></p>'
      + '<ul><li><p>um</p></li></ul><ol><li><p>dois</p></li></ol><p>linha<br>outra</p>'
      + '<h2>Título</h2><blockquote>citação</blockquote>';
    expect(htmlSeguro(html)).toBe(html);
  });

  it('mantém b, i, u, s e cabeçalhos antigos', () => {
    const html = '<p><b>b</b><i>i</i><u>u</u><s>s</s></p><h1>h1</h1><h3>h3</h3>';
    expect(htmlSeguro(html)).toBe(html);
  });

  it('mantém tabela de e-mail com estilo e atributos de layout', () => {
    const html = '<table width="600" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="#ffffff">'
      + '<tbody><tr><td valign="top" style="padding: 10px; color: #333333; font-size: 14px">Oi</td></tr></tbody></table>';
    const div = montar(htmlSeguro(html));
    const table = div.querySelector('table')!;
    expect(table.getAttribute('width')).toBe('600');
    expect(table.getAttribute('bgcolor')).toBe('#ffffff');
    const td = div.querySelector('td')!;
    expect(td.getAttribute('valign')).toBe('top');
    expect(td.getAttribute('style')).toContain('padding: 10px');
    expect(td.getAttribute('style')).toContain('color: #333333');
    expect(td.textContent).toBe('Oi');
  });

  it('mantém imagem http(s) e imagem embutida, com tamanho e texto alternativo', () => {
    const div = montar(htmlSeguro(
      '<img src="https://exemplo.com/a.png" alt="logo" width="120">'
      + '<img src="data:image/png;base64,iVBORw0KGgo=" alt="emb">',
    ));
    const imgs = div.querySelectorAll('img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0].getAttribute('src')).toBe('https://exemplo.com/a.png');
    expect(imgs[0].getAttribute('alt')).toBe('logo');
    expect(imgs[0].getAttribute('width')).toBe('120');
    expect(imgs[1].getAttribute('src')).toMatch(/^data:image\/png/);
  });

  it('link abre em outra aba, sem acesso à aba do CRM', () => {
    const div = montar(htmlSeguro(
      '<a href="https://exemplo.com">site</a> <a href="mailto:a@b.com">mail</a> <a href="tel:+5511999999999">tel</a>',
    ));
    const links = div.querySelectorAll('a');
    expect(links).toHaveLength(3);
    for (const a of Array.from(links)) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    }
    expect(links[0].getAttribute('href')).toBe('https://exemplo.com');
  });

  it('tira classe e id (não pegam estilo nem nome do app)', () => {
    const div = montar(htmlSeguro('<div class="fixed inset-0" id="root">x</div>'));
    const d = div.querySelector('div')!;
    expect(d.hasAttribute('class')).toBe(false);
    expect(d.hasAttribute('id')).toBe(false);
    expect(d.textContent).toBe('x');
  });

  it('tira estilo fora do padrão e posição presa na janela, mantendo o resto', () => {
    const fora = montar(htmlSeguro('<p style="width: expression(1)">a</p><p style="background: url(javascript:1)">b</p>'));
    for (const p of Array.from(fora.querySelectorAll('p'))) expect(p.hasAttribute('style')).toBe(false);

    const presa = montar(htmlSeguro('<div style="position: fixed; top: 0; font-weight: bold">c</div>'));
    const estilo = presa.querySelector('div')!.getAttribute('style') ?? '';
    expect(estilo).not.toMatch(/position/i);
    expect(estilo).toContain('font-weight: bold');

    const fundo = montar(htmlSeguro('<div style="background-image: url(https://exemplo.com/f.png)">d</div>'));
    expect(fundo.innerHTML).toContain('url(https://exemplo.com/f.png)');
  });

  it('nota interna: tira as cores do estilo e mantém o texto', () => {
    const saida = htmlSeguro('<p style="color: red; font-weight: bold">a color: b</p>', { semCor: true });
    const p = montar(saida).querySelector('p')!;
    expect(p.getAttribute('style')).toBe('font-weight: bold');
    expect(p.textContent).toBe('a color: b');
    // Sem a opção, a cor fica.
    expect(htmlSeguro('<p style="color: red">a</p>')).toContain('color: red');
  });

  it('documento inteiro vira só o corpo', () => {
    const saida = htmlSeguro('<!DOCTYPE html><html><head><title>T</title><style>p{}</style></head><body><p>Corpo</p></body></html>');
    expect(saida).toBe('<p>Corpo</p>');
  });

  it('aceita vazio e nulo', () => {
    expect(htmlSeguro('')).toBe('');
    expect(htmlSeguro(null)).toBe('');
    expect(htmlSeguro(undefined)).toBe('');
  });
  describe('classes em lista fechada (contrato da Locação, auditoria 3E-07)', () => {
    it('sem a opção, class sai sempre', () => {
      expect(htmlSeguro('<span class="blank">x</span>')).toBe('<span>x</span>');
    });

    it('com a opção, só ficam os nomes da lista', () => {
      const html = htmlSeguro('<span class="blank intruso">x</span><p class="outra">y</p>', { classes: ['blank'] });
      expect(html).toBe('<span class="blank">x</span><p>y</p>');
    });

    it('a lista de classes não libera script nem evento', () => {
      const html = htmlSeguro('<span class="blank" onmouseover="alert(1)">x</span><img src=x onerror=alert(1)><script>alert(1)</script>', {
        classes: ['blank'],
      });
      expect(html).not.toMatch(/onmouseover|onerror|<script/i);
      expect(html).toContain('<span class="blank">x</span>');
    });

    it('a chamada seguinte, sem a opção, volta a tirar class', () => {
      htmlSeguro('<span class="blank">x</span>', { classes: ['blank'] });
      expect(htmlSeguro('<span class="blank">x</span>')).toBe('<span>x</span>');
    });
  });
});
