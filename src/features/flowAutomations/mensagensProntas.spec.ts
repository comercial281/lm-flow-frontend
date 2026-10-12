import { describe, it, expect } from 'vitest';
import type { FlowAutomation, FlowAutomationNode } from '@/types/flowAutomations';
import { itemPronto, resumoDoFunil, tipoDaSequencia } from './mensagensProntas';

const no = (id: string, kind: string, config: Record<string, unknown>, next: string | null = null) =>
  ({ id, kind, label: null, config, next_node_id: next, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [] }) as unknown as FlowAutomationNode;

const funil = (nodes?: FlowAutomationNode[]) =>
  ({ id: 'f', name: 'F', initial_node_id: nodes?.[0]?.id ?? null, nodes, message_count: 2 }) as unknown as FlowAutomation;

describe('Mensagens prontas: tipo', () => {
  it('um passo só: texto, áudio e mídia', () => {
    expect(tipoDaSequencia([{ kind: 'send_whatsapp', text: 'Oi' }])).toBe('mensagem');
    expect(tipoDaSequencia([{ kind: 'contact', text: 'Contato: Ana' }])).toBe('mensagem');
    expect(tipoDaSequencia([{ kind: 'send_whatsapp', media_kind: 'audio' }])).toBe('audio');
    expect(tipoDaSequencia([{ kind: 'send_whatsapp', media_kind: 'image', text: 'Fachada' }])).toBe('midia');
    expect(tipoDaSequencia([{ kind: 'send_whatsapp', media_source: 'property_book' }])).toBe('midia');
  });

  it('mais de um passo, ou passo que não é envio, é funil', () => {
    expect(tipoDaSequencia([{ kind: 'send_whatsapp', text: 'Oi' }, { kind: 'wait', seconds: 10 }])).toBe('funil');
    expect(tipoDaSequencia([{ kind: 'other', label: 'Aplicar etiqueta' }])).toBe('funil');
    expect(tipoDaSequencia([])).toBe('funil');
  });

  it('lê os blocos do funil; sem blocos na lista, é funil e a prévia fica pra depois', () => {
    expect(itemPronto(funil([no('a', 'send_whatsapp', { media_kind: 'audio' })])).tipo).toBe('audio');
    expect(itemPronto(funil())).toMatchObject({ tipo: 'funil', passos: null });
  });
});

describe('Mensagens prontas: resumo do funil', () => {
  it('conta as mensagens e soma as esperas', () => {
    expect(resumoDoFunil([
      { kind: 'send_whatsapp', text: 'Oi' },
      { kind: 'wait', seconds: 86400 },
      { kind: 'send_whatsapp', media_kind: 'audio' },
      { kind: 'wait', seconds: 86400 },
      { kind: 'send_whatsapp', text: 'E aí?' },
    ])).toBe('3 mensagens · 2 dias');
    expect(resumoDoFunil([{ kind: 'send_whatsapp', text: 'Oi' }, { kind: 'other', label: 'x' }])).toBe('1 mensagem');
  });

  it('sem os blocos, usa a contagem da lista', () => {
    expect(resumoDoFunil(null, 2)).toBe('2 mensagens');
    expect(resumoDoFunil(null)).toBe('');
  });
});
