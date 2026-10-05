import { act, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { RichTextEditor, type RichTextEditorRef } from './RichTextEditor';
import { atalhosDoEditor } from './atalhosDoEditor';
import { messageSchema } from './schema';

vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));

describe('atalhosDoEditor', () => {
  it('desfazer/refazer ficam mesmo só com negrito e itálico', () => {
    const k = atalhosDoEditor(['bold', 'italic'], messageSchema);
    expect(Object.keys(k).sort()).toEqual(['Mod-Shift-z', 'Mod-b', 'Mod-i', 'Mod-y', 'Mod-z']);
  });
  it('código e lista só entram se pedidos', () => {
    const k = atalhosDoEditor(['code', 'list'], messageSchema);
    expect(k['Mod-`']).toBeTruthy();
    expect(k['Shift-Ctrl-8']).toBeTruthy();
    expect(k['Mod-b']).toBeUndefined();
  });
});

describe('RichTextEditor → placeholder', () => {
  it('trocar a prop atualiza data-placeholder e mantém o texto', () => {
    const ref = createRef<RichTextEditorRef>();
    const { container, rerender } = render(
      <RichTextEditor ref={ref} placeholder="um" acoes={['bold', 'italic']} />,
    );
    const el = () => container.querySelector('.prosemirror-editor') as HTMLElement;
    expect(el().getAttribute('data-placeholder')).toBe('um');
    ref.current!.insertText('olá');
    rerender(<RichTextEditor ref={ref} placeholder="dois" acoes={['bold', 'italic']} />);
    expect(el().getAttribute('data-placeholder')).toBe('dois');
    expect(ref.current!.getContent()).toContain('olá');
  });
});

describe('RichTextEditor → páginas do site (paginaDoSiteSchema)', () => {
  it('o HTML antigo vira o do editor: h1→h2, h4–h6→h3, b→strong, code some (o texto fica)', async () => {
    const { htmlComoOEditorDevolve } = await import('./conteudoDoEditor');
    const { paginaDoSiteSchema } = await import('./schema');
    expect(htmlComoOEditorDevolve(
      '<h1>A</h1><h5>B</h5><p><b>c</b> <code>d</code></p><ol><li><p>x</p></li></ol><blockquote><p>q</p></blockquote><p><a href="https://x.com">l</a> <img src="https://x.com/i.png" alt="i"></p>',
      paginaDoSiteSchema,
    )).toBe(
      '<h2>A</h2><h3>B</h3><p><strong>c</strong> d</p><ol><li><p>x</p></li></ol><blockquote><p>q</p></blockquote><p><a href="https://x.com">l</a> <img src="https://x.com/i.png" alt="i"></p>',
    );
  });

  it('conteudoInicial monta com o HTML; insertImage põe a imagem no cursor', async () => {
    const { paginaDoSiteSchema } = await import('./schema');
    const ref = createRef<RichTextEditorRef>();
    render(<RichTextEditor ref={ref} schema={paginaDoSiteSchema} conteudoInicial="<h2>Oi</h2><p>texto</p>" aoPedirImagem={() => {}} />);
    expect(ref.current!.getContent()).toBe('<h2>Oi</h2><p>texto</p>');
    act(() => ref.current!.insertImage('https://cdn.x/a.png', 'A'));
    expect(ref.current!.getContent()).toContain('<img src="https://cdn.x/a.png" alt="A">');
  });

  it('o chat não ganha título, citação nem imagem, mesmo pedindo: o esquema dele não tem', async () => {
    const { ACOES_DA_PAGINA } = await import('./EditorToolbar');
    const { queryByTitle } = render(<RichTextEditor acoes={ACOES_DA_PAGINA} aoPedirImagem={() => {}} />);
    expect(queryByTitle('Título')).toBeNull();
    expect(queryByTitle('Citação')).toBeNull();
    expect(queryByTitle('Imagem')).toBeNull();
    expect(queryByTitle('richTextEditor.toolbar.bold')).toBeTruthy();
  });

  it('sem quem peça a imagem, o botão Imagem não aparece', async () => {
    const { paginaDoSiteSchema } = await import('./schema');
    const { ACOES_DA_PAGINA } = await import('./EditorToolbar');
    const { queryByTitle } = render(<RichTextEditor schema={paginaDoSiteSchema} acoes={ACOES_DA_PAGINA} />);
    expect(queryByTitle('Imagem')).toBeNull();
    expect(queryByTitle('Título')).toBeTruthy();
  });

  it('link só http(s), mailto:, tel: e caminho do site; imagem só http(s): o resto some (o texto fica)', async () => {
    const { htmlComoOEditorDevolve } = await import('./conteudoDoEditor');
    const { paginaDoSiteSchema } = await import('./schema');
    const html = htmlComoOEditorDevolve(
      '<p><a href="javascript:alert(1)">js</a> <a href="//outro.com">dupla</a> <a href="ftp://x.com">ftp</a> '
      + '<a href="/imoveis">busca</a> <a href="mailto:a@b.com">mail</a> <a href="tel:11999">tel</a> <a href="https://x.com">web</a> '
      + '<img src="data:image/png;base64,AAA" alt="d"><img src="javascript:x" alt="j"><img src="https://x.com/i.png" alt="ok"></p>',
      paginaDoSiteSchema,
    );
    expect(html).toBe(
      '<p>js dupla ftp <a href="/imoveis">busca</a> <a href="mailto:a@b.com">mail</a> <a href="tel:11999">tel</a> '
      + '<a href="https://x.com">web</a> <img src="https://x.com/i.png" alt="ok"></p>',
    );
  });
});

