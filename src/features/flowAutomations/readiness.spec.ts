import { describe, it, expect } from 'vitest';
import { enableProblem, nodeProblem } from './readiness';
import type { FlowNodeKind } from '@/types/flowAutomations';

const b = (kind: FlowNodeKind, config: Record<string, unknown>, label: string | null = null) => ({ kind, config, label });
const gatilho = { event: 'lead.created', conditions: [] };

describe('o fluxo pode ser ligado?', () => {
  it('bloco do modelo com campo em branco recusa, dizendo qual bloco e o que falta', () => {
    const blocos = [
      b('send_whatsapp', { text: 'Oi {{first_name}}', send_from: 'owner' }),
      b('lead_action', { action_type: 'notify_group', params: { message: 'Chegou lead' } }),
    ];
    expect(enableProblem(gatilho, blocos)).toBe('Antes de ligar, complete o bloco "Notificação": falta preencher o destino do aviso.');
  });

  it('usa o apelido do bloco quando tem', () => {
    expect(enableProblem(gatilho, [b('move_stage', {}, 'Vai pra visita')])).toBe('Antes de ligar, complete o bloco "Vai pra visita": escolha a etapa.');
  });

  it('gatilho sem o que exige também recusa', () => {
    expect(enableProblem({ event: '', conditions: [] }, [])).toBe('Antes de ligar: escolha o gatilho do fluxo.');
  });

  it('tudo preenchido liga', () => {
    expect(enableProblem(gatilho, [
      b('lead_action', { action_type: 'assign_via_roleta', params: { roleta_config_id: 'r1' } }),
      b('add_label', { labels: ['tráfego pago'] }),
      b('wait_for_reply', { minutes: 30, indefinite: false }),
    ])).toBeNull();
  });

  it('bloco escondido não trava (continua como estava)', () => {
    expect(nodeProblem(b('http_call', {}))).toBeNull();
    expect(nodeProblem(b('lead_action', { action_type: 'wait', params: {} }))).toBeNull();
  });

  it('etiqueta e mensagem em branco', () => {
    expect(nodeProblem(b('add_label', { labels: [] }))).toBe('Escolha a etiqueta.');
    expect(nodeProblem(b('send_whatsapp', { text: '  ' }))).toBe('Escreva a mensagem.');
  });
});

// Redesenho, PR 8 (16/10/2026): o bloco Mensagem guarda uma sequência em `items`.
describe('bloco Mensagem em sequência (items)', () => {
  const msg = (items: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) =>
    b('send_whatsapp', { text: '', items, ...extra });

  it('mídia sem arquivo pede o arquivo', () => {
    expect(nodeProblem(msg([
      { id: 'a', kind: 'text', text_content: 'Oi' },
      { id: 'b', kind: 'image', media_url: '', media_caption: 'Fachada' },
    ]))).toBe('Escolha o arquivo pra mandar.');
  });

  it('texto vazio pede a mensagem', () => {
    expect(nodeProblem(msg([
      { id: 'a', kind: 'text', text_content: 'Oi' },
      { id: 'b', kind: 'delay', delay_seconds: 5 },
      { id: 'c', kind: 'text', text_content: '  ' },
    ]))).toBe('Escreva a mensagem.');
  });

  it('contato sem telefone pede o telefone', () => {
    expect(nodeProblem(msg([{ id: 'a', kind: 'contact', config: { contact_name: 'Ana', contact_phone: '' } }])))
      .toBe('Escreva o telefone do contato.');
  });

  it('só espera, sem mensagem, pede a mensagem', () => {
    expect(nodeProblem(msg([{ id: 'a', kind: 'delay', delay_seconds: 5 }]))).toBe('Escreva a mensagem.');
  });

  it('a primeira falta que valer, na ordem: arquivo antes de texto', () => {
    expect(nodeProblem(msg([
      { id: 'a', kind: 'text', text_content: '' },
      { id: 'b', kind: 'video', media_url: '' },
    ]))).toBe('Escolha o arquivo pra mandar.');
  });

  it('tudo preenchido: sobra o número e o progresso', () => {
    const pronto = [
      { id: 'a', kind: 'text', text_content: 'Oi' },
      { id: 'b', kind: 'delay', delay_seconds: 5 },
      { id: 'c', kind: 'image', media_url: 'https://cdn/f.jpg', media_caption: '' },
      { id: 'd', kind: 'contact', config: { contact_name: '', contact_phone: '5511999990000' } },
    ];
    expect(nodeProblem(msg(pronto))).toBeNull();
    expect(nodeProblem(msg(pronto, { progress_tag_prefix: '', progress_step: 1 }))).toBe('Escreva o nome da etiqueta de progresso.');
  });

  it('o book não é conferido, mas os outros itens do bloco são', () => {
    expect(nodeProblem(msg([
      { id: 'a', kind: 'property_book', media_caption: '' },
      { id: 'b', kind: 'text', text_content: '' },
    ]))).toBe('Escreva a mensagem.');
    expect(nodeProblem(msg([
      { id: 'a', kind: 'property_book' },
      { id: 'b', kind: 'video', media_url: '' },
    ]))).toBe('Escolha o arquivo pra mandar.');
  });

  it('só o book conta como mensagem: sobram o número e o progresso', () => {
    expect(nodeProblem(msg([{ id: 'a', kind: 'property_book' }]))).toBeNull();
    expect(nodeProblem(msg([{ id: 'a', kind: 'property_book' }], { progress_tag_prefix: '', progress_step: 1 })))
      .toBe('Escreva o nome da etiqueta de progresso.');
  });

  it('o media_source antigo que sobrou não conta como book quando os itens não têm book', () => {
    expect(nodeProblem(msg([{ id: 'legado', kind: 'text', text_content: '' }], { media_source: 'property_book' })))
      .toBe('Escreva a mensagem.');
  });

  it('o formato antigo (sem items) segue igual', () => {
    expect(nodeProblem(b('send_whatsapp', { text: 'Oi' }))).toBeNull();
    expect(nodeProblem(b('send_whatsapp', { text: '' }))).toBe('Escreva a mensagem.');
    expect(nodeProblem(b('send_whatsapp', { text: '', media_kind: 'image', media_url: '' }))).toBe('Escolha o arquivo pra mandar.');
    expect(nodeProblem(b('send_whatsapp', { text: '', contact_phone: '5511999990000' }))).toBeNull();
    expect(nodeProblem(b('send_whatsapp', { text: '', media_source: 'property_book' }))).toBeNull();
    expect(nodeProblem(b('send_whatsapp', { text: 'Oi', items: [] }))).toBeNull();
  });
});
