import { describe, it, expect } from 'vitest';
import type { FlowAutomation, FlowAutomationNode } from '@/types/flowAutomations';
import {
  draftFromConversationFunnel,
  draftNotice,
  funnelMessageCount,
  pickableFunnels,
} from './conversationFunnelDraft';

const node = (id: string, kind: FlowAutomationNode['kind'], config: Record<string, unknown>, next: string | null = null): FlowAutomationNode => ({
  id, kind, label: null, config, next_node_id: next, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [],
});

const flow = (nodes: FlowAutomationNode[], initial = nodes[0]?.id ?? null) => ({ initial_node_id: initial, nodes });

const shape = (items: ReturnType<typeof draftFromConversationFunnel>['items']) =>
  items.map(it => ({
    kind: it.kind,
    text_content: it.text_content,
    media_url: it.media_url,
    media_caption: it.media_caption,
    media_filename: it.media_filename,
    delay_seconds: it.delay_seconds,
    config: it.config,
  }));

describe('funil de conversa → itens do editor de sequência', () => {
  it('texto, espera, foto com legenda e contato, na ordem dos blocos', () => {
    const result = draftFromConversationFunnel(flow([
      node('a', 'send_whatsapp', { text: 'Oi {{nome}}' }, 'b'),
      node('b', 'wait', { mode: 'interval', minutes: 1, seconds: 30 }, 'c'),
      node('c', 'send_whatsapp', { text: 'Olha a fachada', media_url: 'https://x/f.jpg', media_kind: 'image' }, 'd'),
      node('d', 'send_whatsapp', { contact_name: 'Ana', contact_phone: '5511999999999' }),
    ]));

    expect(shape(result.items)).toEqual([
      { kind: 'text', text_content: 'Oi {{nome}}', media_url: null, media_caption: null, media_filename: null, delay_seconds: 0, config: {} },
      { kind: 'delay', text_content: null, media_url: null, media_caption: null, media_filename: null, delay_seconds: 90, config: {} },
      { kind: 'image', text_content: null, media_url: 'https://x/f.jpg', media_caption: 'Olha a fachada', media_filename: null, delay_seconds: 0, config: {} },
      { kind: 'contact', text_content: null, media_url: null, media_caption: null, media_filename: null, delay_seconds: 0, config: { contact_name: 'Ana', contact_phone: '5511999999999' } },
    ]);
    expect(result.skipped).toBe(0);
    expect(result.clampedWaits).toBe(0);
    // Cada item tem a sua chave de tela.
    expect(new Set(result.items.map(it => it.uiKey)).size).toBe(4);
  });

  it('esperas seguidas somam; espera no começo e no fim cai fora', () => {
    const result = draftFromConversationFunnel(flow([
      node('w0', 'wait', { seconds: 5 }, 'a'),
      node('a', 'send_whatsapp', { text: 'Um' }, 'w1'),
      node('w1', 'wait', { seconds: 10 }, 'w2'),
      node('w2', 'wait', { seconds: 20 }, 'b'),
      node('b', 'send_whatsapp', { text: 'Dois' }, 'w3'),
      node('w3', 'wait', { minutes: 5 }),
    ]));
    expect(result.items.map(it => [it.kind, it.kind === 'delay' ? it.delay_seconds : it.text_content])).toEqual([
      ['text', 'Um'],
      ['delay', 30],
      ['text', 'Dois'],
    ]);
  });

  it('espera maior que 10 minutos entra como 10 minutos, e conta pro aviso', () => {
    const result = draftFromConversationFunnel(flow([
      node('a', 'send_whatsapp', { text: 'Um' }, 'w'),
      node('w', 'wait', { minutes: 60 }, 'b'),
      node('b', 'send_whatsapp', { text: 'Dois' }),
    ]));
    expect(result.items[1]).toMatchObject({ kind: 'delay', delay_seconds: 600 });
    expect(result.clampedWaits).toBe(1);
    expect(draftNotice(result)).toBe('Uma espera maior que 10 minutos entrou como 10 minutos.');
  });

  it('áudio e figurinha não levam texto; documento leva o nome do arquivo', () => {
    const result = draftFromConversationFunnel(flow([
      node('a', 'send_whatsapp', { text: 'ignorado', media_url: 'https://x/a.ogg', media_kind: 'audio' }, 'b'),
      node('b', 'send_whatsapp', { text: 'ignorado', media_url: 'https://x/s.webp', media_kind: 'sticker' }, 'c'),
      node('c', 'send_whatsapp', { text: 'Tabela', media_url: 'https://x/t.pdf', media_kind: 'document', media_filename: 'tabela.pdf' }),
    ]));
    expect(shape(result.items).map(it => [it.kind, it.media_caption, it.media_filename])).toEqual([
      ['audio', null, null],
      ['sticker', null, null],
      ['document', 'Tabela', 'tabela.pdf'],
    ]);
  });

  it('"Ação de lead" de mensagem também vira item', () => {
    const result = draftFromConversationFunnel(flow([
      node('a', 'lead_action', { action_type: 'send_whatsapp_message', params: { message: 'Oi' } }, 'b'),
      node('b', 'lead_action', { action_type: 'send_video', params: { media_url: 'https://x/v.mp4', caption: 'Tour' } }),
    ]));
    expect(shape(result.items).map(it => [it.kind, it.text_content, it.media_url, it.media_caption])).toEqual([
      ['text', 'Oi', null, null],
      ['video', null, 'https://x/v.mp4', 'Tour'],
    ]);
  });

  it('bloco que não é mensagem e tipo que a tela não manda ficam de fora, com aviso', () => {
    const result = draftFromConversationFunnel(
      flow([
        node('a', 'send_whatsapp', { text: 'Oi' }, 'b'),
        node('b', 'add_label', { labels: ['quente'] }, 'c'),
        node('c', 'send_whatsapp', { contact_name: 'Ana', contact_phone: '5511' }, 'd'),
        node('d', 'send_whatsapp', { media_url: 'https://x/s.webp', media_kind: 'sticker' }),
      ]),
      { skipKinds: ['contact', 'sticker'] },
    );
    expect(result.items.map(it => it.kind)).toEqual(['text']);
    expect(result.skipped).toBe(3);
    expect(draftNotice(result)).toBe('3 blocos do funil não são mensagens que dê pra mandar aqui e ficaram de fora.');
  });

  it('mensagem vazia não vira item; tipo de mídia sem arquivo sai como texto', () => {
    const result = draftFromConversationFunnel(flow([
      node('a', 'send_whatsapp', { text: '   ' }, 'b'),
      node('b', 'send_whatsapp', { text: 'Só texto', media_kind: 'image' }),
    ]));
    expect(shape(result.items).map(it => [it.kind, it.text_content])).toEqual([['text', 'Só texto']]);
    expect(draftNotice(result)).toBeNull();
  });

  it('segue o caminho principal e não entra em laço', () => {
    const result = draftFromConversationFunnel(flow([
      node('a', 'send_whatsapp', { text: 'Um' }, 'b'),
      node('b', 'send_whatsapp', { text: 'Dois' }, 'a'),
      node('solto', 'send_whatsapp', { text: 'Fora do caminho' }),
    ]));
    expect(result.items.map(it => it.text_content)).toEqual(['Um', 'Dois']);
  });

  it('funil sem blocos', () => {
    expect(draftFromConversationFunnel({ initial_node_id: null, nodes: undefined })).toEqual({ items: [], skipped: 0, clampedWaits: 0 });
  });
});

describe('funis que dá pra usar fora da conversa', () => {
  const f = (id: string, extra: Partial<FlowAutomation>) =>
    ({ id, name: id, is_enabled: true, guide_done: true, archived_at: null, team: false, ...extra }) as FlowAutomation;

  it('só ligados, prontos e não arquivados, em Meus funis × Da equipe, por nome', () => {
    const { mine, team } = pickableFunnels([
      f('Zeta', {}),
      f('Alfa', {}),
      f('Desligado', { is_enabled: false }),
      f('Pela metade', { guide_done: false }),
      f('Arquivado', { archived_at: '2026-10-01' }),
      f('Equipe', { team: true }),
    ]);
    expect(mine.map(x => x.id)).toEqual(['Alfa', 'Zeta']);
    expect(team.map(x => x.id)).toEqual(['Equipe']);
  });

  it('lista vazia ou ausente', () => {
    expect(pickableFunnels(undefined)).toEqual({ mine: [], team: [] });
  });
});

describe('quantas mensagens o funil manda', () => {
  it('usa o message_count da lista; sem ele, conta os blocos; sem nada, null', () => {
    expect(funnelMessageCount({ message_count: 3, initial_node_id: null })).toBe(3);
    expect(funnelMessageCount(flow([
      node('a', 'send_whatsapp', { text: 'Um' }, 'w'),
      node('w', 'wait', { seconds: 5 }, 'b'),
      node('b', 'send_whatsapp', { text: 'Dois' }),
    ]))).toBe(2);
    expect(funnelMessageCount({ initial_node_id: null })).toBeNull();
  });
});
