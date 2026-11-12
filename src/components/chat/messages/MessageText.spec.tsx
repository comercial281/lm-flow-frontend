import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MessageText from './MessageText';

// Os três caminhos que mostram HTML no balão passam pelo mesmo filtro.
const FORA = '<img src="x" onerror="window.__marca=1"><iframe src="https://exemplo.com"></iframe>'
  + '<a href="javascript:void(0)">x</a>';

function semNadaForaDaLista(container: HTMLElement) {
  expect(container.querySelector('iframe')).toBeNull();
  expect(container.querySelector('[onerror]')).toBeNull();
  for (const a of Array.from(container.querySelectorAll('a[href]'))) {
    expect(a.getAttribute('href')).not.toMatch(/^javascript:/i);
  }
}

describe('MessageText: HTML no balão', () => {
  it('e-mail recebido mantém a formatação e tira o resto', () => {
    const { container } = render(
      <MessageText
        content="texto"
        contentType="incoming_email"
        contentAttributes={{ email: { html_content: { full: `<p><strong>Oi</strong> <a href="https://exemplo.com">site</a></p>${FORA}` } } }}
      />,
    );
    semNadaForaDaLista(container);
    expect(container.querySelector('.email-html-content strong')?.textContent).toBe('Oi');
    const link = container.querySelector('.email-html-content a[href="https://exemplo.com"]');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('mensagem com HTML mantém a formatação e tira o resto', () => {
    const { container } = render(
      <MessageText content={`<p><em>itálico</em> e <b>negrito</b> numa mensagem longa o bastante</p>${FORA}`} />,
    );
    semNadaForaDaLista(container);
    expect(container.querySelector('em')?.textContent).toBe('itálico');
    expect(container.querySelector('b')?.textContent).toBe('negrito');
  });

  it('nota interna passa pelo mesmo filtro, sem as cores', () => {
    const { container } = render(
      <MessageText isPrivateNote content={`<p style="color: red"><strong>nota</strong></p>${FORA}`} />,
    );
    semNadaForaDaLista(container);
    expect(container.querySelector('.rich-content strong')?.textContent).toBe('nota');
    expect(container.querySelector('.rich-content p')?.getAttribute('style')).toBeNull();
  });

  it('texto puro continua virando texto com link clicável', () => {
    const { container } = render(<MessageText content={'olá\nveja https://exemplo.com/a'} />);
    expect(container.textContent).toContain('olá');
    expect(container.querySelector('a[href="https://exemplo.com/a"]')).not.toBeNull();
  });
});
