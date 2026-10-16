import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Book pelo site (05/10/2026): "Book do imóvel de interesse" no Enviar WhatsApp,
// os blocos "Passar para a IA" e "Desligar a IA" e o gatilho "Pediu o book no site".

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { forms: vi.fn(), formQuestions: vi.fn() },
  flowAutomationFoldersService: {},
}));
vi.mock('@/services/numbers/numbersService', () => ({
  default: { sendNumbers: vi.fn().mockResolvedValue({ number_owner_rule: false, numbers: [] }) },
}));

import { FlowNodePanel } from './FlowNodePanel';
import { summaryLine } from './FlowNodeCard';
import type { AutomationResources } from '@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors';
import type { FlowAutomationNode } from '@/types/flowAutomations';
import { paletteItems } from '@/features/flowAutomations/palette';
import { blockDescription } from '@/features/flowAutomations/blockInfo';
import { nodeProblem } from '@/features/flowAutomations/readiness';
import { FLOW_TRIGGER_EVENTS, flowTriggerLabel } from '@/features/flowAutomations/trigger';

const resources = {
  labels: [], sequences: [], followupFlows: [], users: [], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
} as unknown as AutomationResources;

const node = (patch: Partial<FlowAutomationNode>): FlowAutomationNode => ({
  id: 'n1', kind: 'send_whatsapp', label: null, config: {},
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [],
  ...patch,
});

// PR 8 (16/10/2026): o book virou item da sequência do bloco Mensagem.
describe('Mensagem: o book do imóvel é um item', () => {
  it('"+ Book do imóvel" põe o item na sequência e grava em items', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ config: { text: 'Oi {{nome}}' } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    expect(screen.queryByLabelText('Book do imóvel de interesse')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Book do imóvel' }));
    expect(screen.getByText('Pega sozinho o book (PDF) do empreendimento do lead. Acima de 16 MB vai como link.')).toBeTruthy();
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const cfg = onSave.mock.calls[0][1].config;
    expect(cfg.text).toBe('');
    expect(cfg.items).toEqual([
      { id: 'legado', kind: 'text', text_content: 'Oi {{nome}}' },
      expect.objectContaining({ kind: 'property_book', media_caption: '' }),
    ]);
  });

  it('o bloco antigo de book abre como 1 item de book, com o texto na legenda', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ config: { text: 'Oi', media_source: 'property_book', media_url: '' } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    expect(screen.getByText('Book do imóvel', { selector: 'span' })).toBeTruthy();
    const legenda = screen.getByPlaceholderText('Legenda (opcional)') as HTMLInputElement;
    expect(legenda.value).toBe('Oi');
    fireEvent.change(legenda, { target: { value: 'Segue o book' } });
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][1].config.items).toEqual([{ id: 'legado', kind: 'property_book', media_caption: 'Segue o book' }]);
  });

  it('o cartão mostra o resumo e o bloco não pede texto', () => {
    expect(summaryLine(node({ config: { media_source: 'property_book', text: '' } }))).toBe('Manda o book do imóvel de interesse');
    expect(nodeProblem({ kind: 'send_whatsapp', config: { media_source: 'property_book', text: '' } })).toBeNull();
    expect(nodeProblem({ kind: 'send_whatsapp', config: { text: '' } })).toBe('Escreva a mensagem.');
  });
});

describe('cartão do bloco Mensagem em sequência', () => {
  it('com 1 mensagem, a linha dela; com mais de uma, quantas (as esperas não contam)', () => {
    expect(summaryLine(node({ config: { text: '', items: [{ id: 'a', kind: 'image', media_url: 'https://x/f.jpg', media_caption: 'Olha a fachada' }] } })))
      .toBe('Foto: Olha a fachada');
    expect(summaryLine(node({ config: { text: '', items: [{ id: 'a', kind: 'delay', delay_seconds: 5 }, { id: 'b', kind: 'text', text_content: 'Oi' }] } })))
      .toBe('Oi');
    expect(summaryLine(node({
      config: {
        text: '',
        items: [
          { id: 'a', kind: 'text', text_content: 'Oi' },
          { id: 'b', kind: 'delay', delay_seconds: 5 },
          { id: 'c', kind: 'image', media_url: 'https://x/f.jpg' },
          { id: 'd', kind: 'property_book' },
        ],
      },
    }))).toBe('3 mensagens');
  });

  it('cada tipo de item tem a sua linha', () => {
    const um = (item: Record<string, unknown>) => summaryLine(node({ config: { text: '', items: [{ id: 'a', ...item }] } }));
    expect(um({ kind: 'text', text_content: '' })).toBe('(mensagem vazia)');
    expect(um({ kind: 'video', media_url: '' })).toBe('Vídeo (escolha o arquivo)');
    expect(um({ kind: 'document', media_url: 'https://x/d.pdf', media_caption: '' })).toBe('Documento');
    expect(um({ kind: 'contact', config: { contact_name: 'Ana', contact_phone: '5511' } })).toBe('Contato: Ana');
    expect(um({ kind: 'property_book', media_caption: 'Segue' })).toBe('Manda o book do imóvel de interesse');
  });

  it('book junto com texto vazio: o cartão conta as duas e mostra o que falta', () => {
    const cfg = { text: '', items: [{ id: 'a', kind: 'property_book' }, { id: 'b', kind: 'text', text_content: '' }] };
    expect(summaryLine(node({ config: cfg }))).toBe('2 mensagens');
    expect(nodeProblem({ kind: 'send_whatsapp', config: cfg })).toBe('Escreva a mensagem.');
  });

  it('o media_source antigo que sobrou não vira book quando os itens não têm book', () => {
    expect(summaryLine(node({ config: { text: '', media_source: 'property_book', items: [{ id: 'legado', kind: 'text', text_content: 'Oi' }] } })))
      .toBe('Oi');
  });
});

describe('blocos da IA', () => {
  it.each([
    ['hand_to_ai', 'Passar para a IA', 'A IA Vendedora do número da conversa passa a responder este lead, mesmo sem os gatilhos dela. Vale o horário de atendimento dela.'],
    ['disable_ai', 'Desligar a IA', "A IA para de responder este lead (igual a 'IA desligada' no card)."],
  ] as const)('%s está na paleta, grupo IA, com a ajuda', (kind, label, help) => {
    const item = paletteItems().find(i => i.kind === kind);
    expect(item).toMatchObject({ label, group: 'ai', config: {} });
    expect(blockDescription({ kind })).toBe(help);
  });

  it('a janela só traz a explicação e salva sem config', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ kind: 'disable_ai' })} resources={resources} onClose={() => {}} onSave={onSave} />);
    expect(screen.getByRole('heading', { name: 'Desligar a IA' })).toBeTruthy();
    expect(screen.getAllByText("A IA para de responder este lead (igual a 'IA desligada' no card).").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('n1', { label: '', config: {} }));
  });

  it('o cartão diz o que o bloco faz', () => {
    expect(summaryLine(node({ kind: 'hand_to_ai' }))).toContain('IA Vendedora');
    expect(summaryLine(node({ kind: 'disable_ai' }))).toContain('para de responder');
  });
});

describe('gatilho "Pediu o book no site"', () => {
  it('está na lista e tem rótulo', () => {
    expect(FLOW_TRIGGER_EVENTS).toContain('lead.book_requested');
    expect(flowTriggerLabel('lead.book_requested')).toBe('Pediu o book no site');
  });
});
