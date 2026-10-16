import { describe, it, expect } from 'vitest';
import {
  draftsOf, hasMessageContent, hasMessageMedia, itemsOf, messageItemsOf, withItems,
} from './messageItems';
import type { SequenceDraftItem } from '@/components/messaging/MessageSequenceEditor';

// Redesenho do construtor, PR 8 (16/10/2026): o bloco Mensagem guarda uma
// sequência em `config.items`. Este é o espelho do `MessageItems` do servidor:
// o bloco antigo, sem `items`, é lido como sequência de um item.

const draft = (patch: Partial<SequenceDraftItem>): SequenceDraftItem => ({
  uiKey: 'k1', kind: 'text', text_content: '', media_url: null, media_filename: null, media_caption: null,
  delay_seconds: 0, config: {}, pendingFile: null, ...patch,
});

describe('itemsOf: os 4 formatos antigos viram um item', () => {
  it('texto', () => {
    expect(itemsOf({ text: 'Oi {{nome}}' })).toEqual([{ id: 'legado', kind: 'text', text_content: 'Oi {{nome}}' }]);
  });

  it('foto com legenda', () => {
    expect(itemsOf({ text: 'Olha a fachada', media_url: 'https://cdn/foto.jpg', media_kind: 'image', media_filename: 'foto.jpg' }))
      .toEqual([{
        id: 'legado', kind: 'image', media_url: 'https://cdn/foto.jpg', media_filename: 'foto.jpg', media_caption: 'Olha a fachada',
      }]);
  });

  it('mídia sem media_kind cai em documento, como no servidor', () => {
    expect(itemsOf({ media_url: 'https://cdn/x.pdf' })[0].kind).toBe('document');
  });

  it('contato', () => {
    expect(itemsOf({ contact_name: 'Giovani', contact_phone: '5511999999999' })).toEqual([{
      id: 'legado', kind: 'contact', config: { contact_name: 'Giovani', contact_phone: '5511999999999' },
    }]);
  });

  it('book com texto (o book ganha da mídia)', () => {
    expect(itemsOf({ media_source: 'property_book', text: 'Segue o book', media_url: '' })).toEqual([{
      id: 'legado', kind: 'property_book', media_caption: 'Segue o book',
    }]);
  });

  it('com items, os campos soltos são ignorados', () => {
    const items = [{ id: 'a', kind: 'text', text_content: 'Oi' }];
    expect(itemsOf({ text: 'velho', media_url: 'u', items })).toEqual(items);
  });

  it('items vazio é o formato antigo', () => {
    expect(itemsOf({ text: 'Oi', items: [] })).toEqual([{ id: 'legado', kind: 'text', text_content: 'Oi' }]);
  });
});

describe('messageItemsOf', () => {
  it('tira as esperas', () => {
    const config = { items: [
      { id: 'a', kind: 'text', text_content: 'Oi' },
      { id: 'b', kind: 'delay', delay_seconds: 5 },
      { id: 'c', kind: 'image', media_url: 'u' },
    ] };
    expect(messageItemsOf(config).map(i => i.id)).toEqual(['a', 'c']);
  });
});

describe('hasMessageContent e hasMessageMedia (mesmos casos do servidor)', () => {
  it('só espaços não é conteúdo', () => {
    expect(hasMessageContent({ items: [{ id: 'a', kind: 'text', text_content: '   ' }] })).toBe(false);
    expect(hasMessageContent({ text: '   ' })).toBe(false);
  });

  it('item de contato é conteúdo', () => {
    expect(hasMessageContent({ items: [{ id: 'a', kind: 'contact', config: { contact_phone: '5511999999999' } }] })).toBe(true);
  });

  it('book sem legenda é conteúdo', () => {
    expect(hasMessageContent({ items: [{ id: 'a', kind: 'property_book', media_caption: '' }] })).toBe(true);
    expect(hasMessageContent({ media_source: 'property_book', text: '' })).toBe(true);
  });

  it('só espera não é conteúdo', () => {
    expect(hasMessageContent({ items: [{ id: 'a', kind: 'delay', delay_seconds: 5 }] })).toBe(false);
  });

  it('mídia: algum item tem arquivo', () => {
    expect(hasMessageMedia({ items: [{ id: 'a', kind: 'delay', delay_seconds: 5 }, { id: 'b', kind: 'image', media_url: 'u' }] })).toBe(true);
    expect(hasMessageMedia({ items: [{ id: 'a', kind: 'image', media_url: '' }] })).toBe(false);
    expect(hasMessageMedia({ media_url: 'u', media_kind: 'video' })).toBe(true);
    expect(hasMessageMedia({ text: 'Oi' })).toBe(false);
  });
});

describe('draftsOf e withItems', () => {
  it('o id faz ida e volta pelo uiKey (o modo guiado do servidor casa itens por id)', () => {
    const config = { items: [
      { id: 'a', kind: 'text', text_content: 'Oi' },
      { id: 'b', kind: 'delay', delay_seconds: 5, config: { random_interval: true, min_seconds: 3, max_seconds: 8 } },
    ] };
    const drafts = draftsOf(config);
    expect(drafts.map(d => d.uiKey)).toEqual(['a', 'b']);
    expect(drafts[1]).toMatchObject({ kind: 'delay', delay_seconds: 5, config: { random_interval: true, min_seconds: 3, max_seconds: 8 } });
    expect(withItems(config, drafts).items).toEqual(config.items);
  });

  it('bloco antigo abre com o id legado e sempre o mesmo (desenhar de novo não troca a chave)', () => {
    expect(draftsOf({ text: 'Oi' })).toEqual(draftsOf({ text: 'Oi' }));
    expect(draftsOf({ text: 'Oi' })[0]).toMatchObject({ uiKey: 'legado', kind: 'text', text_content: 'Oi', pendingFile: null });
  });

  it('withItems grava só o formato guardado, zera os campos soltos e preserva media_source, send_from e progresso', () => {
    const config = {
      text: 'velho', media_url: 'u', media_kind: 'image', media_filename: 'f.jpg', contact_name: 'G', contact_phone: '55',
      media_source: 'property_book', send_from: 'inbox', send_from_inbox_id: 7,
      progress_tag_prefix: 'fu', progress_step: 2,
    };
    const next = withItems(config, [
      draft({ uiKey: 'a', kind: 'text', text_content: 'Oi', text_variations: ['Olá'], serverItemId: 's1' }),
      draft({ uiKey: 'b', kind: 'image', text_content: null, media_url: 'https://cdn/foto.jpg', media_filename: 'foto.jpg', media_caption: 'Fachada' }),
      draft({ uiKey: 'c', kind: 'property_book', text_content: null, media_caption: 'Segue' }),
      draft({ uiKey: 'd', kind: 'contact', text_content: null, config: { contact_name: 'G', contact_phone: '5511' } }),
      draft({ uiKey: 'e', kind: 'delay', text_content: null, delay_seconds: 30 }),
    ]);
    expect(next).toEqual({
      text: '', media_url: '', media_kind: '', media_filename: '', contact_name: '', contact_phone: '',
      media_source: 'property_book', send_from: 'inbox', send_from_inbox_id: 7,
      progress_tag_prefix: 'fu', progress_step: 2,
      items: [
        { id: 'a', kind: 'text', text_content: 'Oi' },
        { id: 'b', kind: 'image', media_url: 'https://cdn/foto.jpg', media_filename: 'foto.jpg', media_caption: 'Fachada' },
        { id: 'c', kind: 'property_book', media_caption: 'Segue' },
        { id: 'd', kind: 'contact', config: { contact_name: 'G', contact_phone: '5511' } },
        { id: 'e', kind: 'delay', delay_seconds: 30, config: {} },
      ],
    });
  });

  it('bloco antigo de foto salvo de volta vira 1 item com a mesma foto e legenda', () => {
    const config = { text: 'Fachada', media_url: 'https://cdn/foto.jpg', media_kind: 'image', media_filename: 'foto.jpg' };
    expect(withItems(config, draftsOf(config)).items).toEqual([
      { id: 'legado', kind: 'image', media_url: 'https://cdn/foto.jpg', media_filename: 'foto.jpg', media_caption: 'Fachada' },
    ]);
  });
});

// Rede de segurança de deploy/rollback: o servidor antes do backend #497 ignora
// `items` e lê só os campos soltos. Uma mensagem só, sem espera, vai também nos
// campos soltos; o resto fica em branco (nesse servidor, não manda nada).
describe('withItems: uma mensagem só também vai nos campos soltos', () => {
  const loose = (config: Record<string, unknown>) => ({
    text: config.text, media_url: config.media_url, media_kind: config.media_kind, media_filename: config.media_filename,
    contact_name: config.contact_name, contact_phone: config.contact_phone,
  });
  const old = { text: 'velho', media_url: 'u', media_kind: 'video', media_filename: 'v.mp4', contact_name: 'X', contact_phone: '1' };

  it('1 texto: vai em text', () => {
    const next = withItems(old, [draft({ uiKey: 'a', kind: 'text', text_content: 'Oi, {{nome}}' })]);
    expect(loose(next)).toEqual({ text: 'Oi, {{nome}}', media_url: '', media_kind: '', media_filename: '', contact_name: '', contact_phone: '' });
    expect(next.items).toEqual([{ id: 'a', kind: 'text', text_content: 'Oi, {{nome}}' }]);
  });

  it('1 foto com legenda: arquivo nos campos de mídia e a legenda em text', () => {
    const next = withItems(old, [draft({
      uiKey: 'a', kind: 'image', text_content: null, media_url: 'https://cdn/foto.jpg', media_filename: 'foto.jpg', media_caption: 'Fachada',
    })]);
    expect(loose(next)).toEqual({
      text: 'Fachada', media_url: 'https://cdn/foto.jpg', media_kind: 'image', media_filename: 'foto.jpg', contact_name: '', contact_phone: '',
    });
  });

  it('1 contato: nome e telefone, text vazio', () => {
    const next = withItems(old, [draft({ uiKey: 'a', kind: 'contact', text_content: null, config: { contact_name: 'Giovani', contact_phone: '5511999' } })]);
    expect(loose(next)).toEqual({ text: '', media_url: '', media_kind: '', media_filename: '', contact_name: 'Giovani', contact_phone: '5511999' });
  });

  it('1 book: a legenda vai em text e media_source não é mexido', () => {
    const next = withItems({ ...old, media_source: 'property_book' }, [draft({ uiKey: 'a', kind: 'property_book', text_content: null, media_caption: 'Segue o book' })]);
    expect(loose(next)).toEqual({ text: 'Segue o book', media_url: '', media_kind: '', media_filename: '', contact_name: '', contact_phone: '' });
    expect(next.media_source).toBe('property_book');
    const semBook = withItems({ media_source: '' }, [draft({ uiKey: 'a', kind: 'property_book', text_content: null, media_caption: 'Segue' })]);
    expect(semBook.media_source).toBe('');
  });

  it('2 mensagens, ou texto + espera: os campos soltos ficam em branco', () => {
    const blank = { text: '', media_url: '', media_kind: '', media_filename: '', contact_name: '', contact_phone: '' };
    expect(loose(withItems(old, [
      draft({ uiKey: 'a', kind: 'text', text_content: 'Oi' }),
      draft({ uiKey: 'b', kind: 'text', text_content: 'Tudo bem?' }),
    ]))).toEqual(blank);
    expect(loose(withItems(old, [
      draft({ uiKey: 'a', kind: 'text', text_content: 'Oi' }),
      draft({ uiKey: 'b', kind: 'delay', text_content: null, delay_seconds: 30 }),
    ]))).toEqual(blank);
    expect(loose(withItems(old, [draft({ uiKey: 'b', kind: 'delay', text_content: null, delay_seconds: 30 })]))).toEqual(blank);
  });
});
