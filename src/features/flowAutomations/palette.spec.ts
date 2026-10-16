import { describe, it, expect } from 'vitest';
import { FLOW_NODE_DEFS } from '@/types/flowAutomations';
import { ACTION_TYPE_LABELS } from '@/services/leadAutomation/leadAutomationService';
import { freshBlockConfig, isVisibleKind, isVisibleNode, paletteGroups, paletteItems, blockLabel, HIDDEN_BLOCK_NOTICE } from './palette';
import { summaryLine } from '@/components/flowAutomations/FlowNodeCard';

const node = (kind: string, config: Record<string, unknown> = {}) => ({
  id: 'x', kind: kind as never, label: null, config,
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [],
});

describe('paleta da sprint 2', () => {
  it('os blocos da spec, nos seis grupos e na ordem da tabela', () => {
    expect(paletteGroups().map(g => [g.label, g.items.map(i => i.label)])).toEqual([
      // PR 8 (16/10/2026): áudio, imagem, vídeo, documento e figurinha viraram itens do bloco Mensagem.
      ['Mensagem', ['Mensagem', 'Mandar resposta rápida', 'Disparar funil de mensagens']],
      ['Lead', [
        'Aplicar etiqueta', 'Tirar etiqueta', 'Mover de etapa', 'Marcar como recuperado pelo follow-up',
        'Criar tarefa', 'Iniciar follow-up',
      ]],
      ['IA', ['Passar para a IA', 'Desligar a IA']],
      ['Distribuição', ['Definir corretor', 'Distribuir pela roleta']],
      ['Notificação', ['Avisar no grupo', 'Avisar pessoa', 'Avisar corretor', 'Avisar gestor', 'Notificação no celular']],
      ['Controle', ['Esperar', 'Aguardar resposta', 'Se / senão', 'Só continuar se']],
    ]);
  });

  it('nenhum nome repetido: onde a sprint 1 já tem bloco, fica o da sprint 1', () => {
    const items = paletteItems();
    const labels = items.map(i => i.label);
    expect(new Set(labels).size).toBe(labels.length);
    const byLabel = (l: string) => items.find(i => i.label === l)!;
    expect(byLabel('Mensagem').kind).toBe('send_whatsapp');
    expect(byLabel('Aplicar etiqueta').kind).toBe('add_label');
    expect(byLabel('Tirar etiqueta').kind).toBe('remove_label');
    expect(byLabel('Mover de etapa').kind).toBe('move_stage');
  });

  // Sprint 3: "Iniciar follow-up" é o `start_followup_flow` (escolhe um fluxo
  // de follow-up); o do funil antigo não é mais oferecido.
  it('toda ação das Automações tem bloco, menos "Aguardar (delay)" e o follow-up antigo', () => {
    const actions = new Set(paletteItems().filter(i => i.kind === 'lead_action').map(i => i.config.action_type));
    const comBlocoProprio = ['send_whatsapp_message', 'add_label', 'remove_label', 'move_pipeline_stage'];
    // Os envios de mídia são itens do bloco Mensagem (PR 8); os blocos antigos continuam abrindo.
    const itensDaMensagem = ['send_audio', 'send_image', 'send_video', 'send_document', 'send_sticker'];
    itensDaMensagem.forEach(t => expect(actions.has(t)).toBe(false));
    const faltando = Object.keys(ACTION_TYPE_LABELS).filter(t => !actions.has(t) && !comBlocoProprio.includes(t) && !itensDaMensagem.includes(t));
    expect(faltando).toEqual(['start_followup_sequence', 'wait']);
    expect(paletteItems().find(i => i.label === 'Iniciar follow-up')?.config).toEqual({ action_type: 'start_followup_flow', params: {} });
  });

  it('o botão da ação cria o bloco lead_action com { action_type, params }', () => {
    const avisar = paletteItems().find(i => i.label === 'Avisar no grupo')!;
    expect(avisar).toMatchObject({ kind: 'lead_action', group: 'notify', config: { action_type: 'notify_group', params: {} } });
    // Cada clique ganha a própria config (não compartilha o objeto).
    const [a, b] = [paletteItems(), paletteItems()].map(list => list.find(i => i.key === avisar.key)!);
    expect(a.config).not.toBe(b.config);
  });

  it('os blocos antigos do Hub ficam fora da paleta', () => {
    const fora = FLOW_NODE_DEFS.filter(d => !isVisibleKind(d.kind)).map(d => d.kind);
    expect(fora).toEqual(expect.arrayContaining(['send_email', 'send_capi', 'notify_bell', 'webhook', 'http_call', 'assign_owner', 'assign_round_robin', 'call_flow']));
    const naPaleta = paletteItems().map(i => i.kind);
    fora.forEach(k => expect(naPaleta).not.toContain(k));
  });

  it('a busca ignora acento e maiúscula', () => {
    expect(paletteGroups('AGUARDAR').flatMap(g => g.items.map(i => i.kind))).toEqual(['wait_for_reply']);
    expect(paletteGroups('so continuar').flatMap(g => g.items.map(i => i.kind))).toEqual(['filter_label']);
    expect(paletteGroups('notificacao').flatMap(g => g.items.map(i => i.label))).toEqual(['Notificação no celular']);
    expect(paletteGroups('nada disso')).toEqual([]);
  });

  it('bloco escondido de fluxo antigo aparece com o aviso, sem quebrar', () => {
    expect(summaryLine(node('http_call', { url: 'https://exemplo' }))).toBe(HIDDEN_BLOCK_NOTICE);
    // Ação que não existe (ou o "Aguardar (delay)") num lead_action também.
    expect(isVisibleNode(node('lead_action', { action_type: 'wait', params: {} }))).toBe(false);
    expect(summaryLine(node('lead_action', { action_type: 'nao_existe' }))).toBe(HIDDEN_BLOCK_NOTICE);
  });

  it('ação convertida de regra que não está na paleta abre com o nome dela', () => {
    expect(isVisibleNode(node('lead_action', { action_type: 'add_label', params: { label_id: 'l1' } }))).toBe(true);
    expect(blockLabel(node('lead_action', { action_type: 'add_label' }))).toBe('Aplicar etiqueta');
    expect(blockLabel(node('lead_action', { action_type: 'send_whatsapp_message' }))).toBe('Mandar WhatsApp');
  });

  it('bloco Mensagem novo já nasce com um item de texto vazio; os blocos antigos de mídia continuam abrindo', () => {
    const mensagem = paletteItems().find(i => i.kind === 'send_whatsapp')!;
    expect(mensagem.label).toBe('Mensagem');
    expect(mensagem.config).toEqual({ items: [{ id: expect.any(String), kind: 'text', text_content: '' }] });
    expect(isVisibleNode(node('lead_action', { action_type: 'send_image', params: { media_url: 'https://x/f.jpg' } }))).toBe(true);
    expect(blockLabel(node('lead_action', { action_type: 'send_image' }))).toBe('Mandar imagem');
  });

  it('cada bloco Mensagem novo tem a própria sequência, com id novo em cada item', () => {
    const [a, b] = [paletteItems(), paletteItems()].map(list => list.find(i => i.kind === 'send_whatsapp')!);
    const itemsA = a.config.items as Array<{ id: string }>;
    const itemsB = b.config.items as Array<{ id: string }>;
    expect(itemsA).not.toBe(itemsB);
    expect(itemsA[0]).not.toBe(itemsB[0]);
    expect(itemsA[0].id).not.toBe(itemsB[0].id);
    // O mesmo botão usado duas vezes também não divide a sequência.
    const c = freshBlockConfig(a.config);
    expect(c.items).not.toBe(a.config.items);
    expect((c.items as Array<{ id: string }>)[0].id).not.toBe(itemsA[0].id);
    expect(FLOW_NODE_DEFS.find(d => d.kind === 'send_whatsapp')!.defaultConfig.items).not.toBe(itemsA);
  });

  it('o sino não fala do Hub', () => {
    expect(FLOW_NODE_DEFS.find(d => d.kind === 'notify_bell')?.label).not.toMatch(/hub/i);
  });
});
