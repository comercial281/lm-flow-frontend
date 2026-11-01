import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// "Não mandar se a IA já estiver conversando com o lead" (Fase 5, Tarefa 79).

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { uploadMedia: vi.fn() },
}));
vi.mock('@/components/messaging/MessageSequenceEditor', () => ({ default: () => <div data-testid="editor" /> }));
vi.mock('@/components/numbers/SendFromField', () => ({ default: () => <div data-testid="send-from" /> }));

import { MessageBlockFields } from './MessageBlockFields';
import type { FlowNodeConfig } from '@/types/flowAutomations';

let last: FlowNodeConfig = {};
function Harness({ initial = {}, conversation = false }: { initial?: FlowNodeConfig; conversation?: boolean }) {
  const [config, setConfig] = useState<FlowNodeConfig>(initial);
  last = config;
  return <MessageBlockFields config={config} onChange={setConfig} conversation={conversation} numeroDoFluxo="Número Ana" />;
}

describe('Mensagem: não mandar se a IA já estiver conversando', () => {
  it('mostra a caixinha e a ajuda', () => {
    render(<Harness />);
    expect(screen.getByRole('checkbox', { name: /Não mandar se a IA já estiver conversando com o lead/ })).toBeTruthy();
    expect(screen.getByText('Liga sozinha nos fluxos de entrada. Use quando o fluxo e a IA falam com o mesmo lead.')).toBeTruthy();
  });

  it('vem marcada quando o bloco guarda true e desmarca gravando false', () => {
    render(<Harness initial={{ skip_if_ai_talking: true }} />);
    const box = screen.getByRole('checkbox', { name: /Não mandar se a IA/ });
    expect(box.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(box);
    expect(last.skip_if_ai_talking).toBe(false);
  });

  it('marcar grava true no rascunho', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Não mandar se a IA/ }));
    expect(last.skip_if_ai_talking).toBe(true);
  });

  it('no funil de conversa não aparece', () => {
    render(<Harness conversation />);
    expect(screen.queryByRole('checkbox', { name: /Não mandar se a IA/ })).toBeNull();
  });
});
