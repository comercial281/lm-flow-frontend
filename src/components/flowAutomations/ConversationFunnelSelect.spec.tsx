import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// "Usar funil" nos modais de sequência (05/10/2026): lista os funis de
// conversa prontos e carrega o escolhido no formato do editor.
const mocks = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() }));
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { list: mocks.list, get: mocks.get },
}));
vi.mock('sonner', () => ({ toast: { success: mocks.success, warning: mocks.warning, error: mocks.error } }));

// O Select da casa (Radix) não abre em jsdom: aqui ele vira um <select> nativo.
vi.mock('@/components/ui/ds', () => {
  const Select = ({ onValueChange, children }: { onValueChange?: (v: string) => void; children?: React.ReactNode }) => (
    <select aria-label="Usar funil" value="" onChange={e => onValueChange?.(e.target.value)}>
      <option value="">Usar funil</option>
      {children}
    </select>
  );
  const pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    Select,
    SelectContent: pass,
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectGroup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    SelectLabel: ({ children }: { children?: React.ReactNode }) => <option disabled>{`— ${String(children)} —`}</option>,
    SelectItem: ({ value, children }: { value: string; children?: React.ReactNode }) => <option value={value}>{children}</option>,
  };
});

import { ConversationFunnelSelect } from './ConversationFunnelSelect';

const f = (id: string, name: string, extra: Record<string, unknown> = {}) =>
  ({ id, name, is_enabled: true, guide_done: true, archived_at: null, team: false, ...extra });

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset());
});

describe('ConversationFunnelSelect', () => {
  it('mostra só os prontos, em Meus funis e Da equipe', async () => {
    mocks.list.mockResolvedValue([
      f('a', 'Meu funil'),
      f('b', 'Desligado', { is_enabled: false }),
      f('c', 'Pela metade', { guide_done: false }),
      f('d', 'Da casa', { team: true }),
    ]);
    render(<ConversationFunnelSelect enabled onLoad={vi.fn()} />);

    expect(await screen.findByRole('option', { name: 'Meu funil' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '— Meus funis —' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '— Da equipe —' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Da casa' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Desligado' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Pela metade' })).toBeNull();
    expect(mocks.list).toHaveBeenCalledWith({ kind: 'conversation' });
  });

  it('sem funil pronto, não aparece', async () => {
    mocks.list.mockResolvedValue([f('b', 'Desligado', { is_enabled: false })]);
    const { container } = render(<ConversationFunnelSelect enabled onLoad={vi.fn()} />);
    await waitFor(() => expect(mocks.list).toHaveBeenCalled());
    expect(container.querySelector('select')).toBeNull();
  });

  it('escolher carrega os blocos no formato do editor e avisa o que ficou de fora', async () => {
    mocks.list.mockResolvedValue([f('a', 'Meu funil')]);
    mocks.get.mockResolvedValue({
      ...f('a', 'Meu funil'),
      initial_node_id: 'n1',
      nodes: [
        { id: 'n1', kind: 'send_whatsapp', label: null, config: { text: 'Oi' }, next_node_id: 'n2', next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [] },
        { id: 'n2', kind: 'send_whatsapp', label: null, config: { contact_name: 'Ana', contact_phone: '5511' }, next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [] },
      ],
    });
    const onLoad = vi.fn();
    render(<ConversationFunnelSelect enabled onLoad={onLoad} skipKinds={['contact']} />);

    fireEvent.change(await screen.findByLabelText('Usar funil'), { target: { value: 'a' } });

    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(1));
    const [items, flow] = onLoad.mock.calls[0];
    expect(items.map((it: { kind: string; text_content: string | null }) => [it.kind, it.text_content])).toEqual([['text', 'Oi']]);
    expect(flow.id).toBe('a');
    expect(mocks.warning).toHaveBeenCalledWith(expect.stringContaining('ficou de fora'));
  });
});
