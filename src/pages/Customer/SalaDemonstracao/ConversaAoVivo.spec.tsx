import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import ConversaAoVivo from './ConversaAoVivo';

const s = vi.hoisted(() => ({ getMessages: vi.fn() }));
vi.mock('@/services/conversations/conversationService', () => ({
  conversationAPI: { getMessages: s.getMessages },
}));
vi.mock('@/components/chat/messages/MessageAudio', () => ({ default: () => <div data-testid="audio" /> }));

const msg = (id: string, type: 'incoming' | 'outgoing', content: string, attachments: unknown[] = [], extra: Record<string, unknown> = {}) => ({
  id, content, message_type: type, created_at: Number(id), attachments, status: 'sent', sender: { name: 'x' }, ...extra,
});

beforeEach(() => { s.getMessages.mockReset(); });
afterEach(() => { vi.useRealTimers(); });

describe('ConversaAoVivo', () => {
  it('sem conversa mostra o aguardo e não consulta', () => {
    render(<ConversaAoVivo conversationId={null} />);
    expect(screen.getByText('A conversa aparece aqui assim que o lead escrever.')).toBeInTheDocument();
    expect(s.getMessages).not.toHaveBeenCalled();
  });

  it('mostra lead à esquerda e IA à direita, com áudio tocável', async () => {
    s.getMessages.mockResolvedValue([
      msg('1', 'incoming', 'Oi, tudo bem?'),
      msg('2', 'outgoing', 'Oi Maria!'),
      msg('3', 'outgoing', '', [{ id: 'a', file_type: 'audio', data_url: 'x.mp3' }]),
    ]);
    render(<ConversaAoVivo conversationId="c1" />);
    const lead = await screen.findByText('Oi, tudo bem?');
    const ia = screen.getByText('Oi Maria!');
    expect(lead.closest('[data-lado]')).toHaveAttribute('data-lado', 'lead');
    expect(ia.closest('[data-lado]')).toHaveAttribute('data-lado', 'ia');
    expect(screen.getByTestId('audio')).toBeInTheDocument();
  });

  it('relê no evento realtime (500 ms) e quando refreshKey muda', async () => {
    vi.useFakeTimers();
    s.getMessages.mockResolvedValue([]);
    const { rerender } = render(<ConversaAoVivo conversationId="c1" refreshKey={1} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(s.getMessages).toHaveBeenCalledTimes(1);
    await act(async () => {
      window.dispatchEvent(new Event('lmflow:realtime'));
      window.dispatchEvent(new Event('lmflow:realtime'));
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(s.getMessages).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(s.getMessages).toHaveBeenCalledTimes(2);
    rerender(<ConversaAoVivo conversationId="c1" refreshKey={2} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(s.getMessages).toHaveBeenCalledTimes(3);
  });

  it('não mostra nota interna', async () => {
    s.getMessages.mockResolvedValue([
      msg('1', 'incoming', 'Oi, tudo bem?'),
      msg('2', 'outgoing', 'Nota interna da equipe', [], { private: true }),
    ]);
    render(<ConversaAoVivo conversationId="c1" />);
    await screen.findByText('Oi, tudo bem?');
    expect(screen.queryByText('Nota interna da equipe')).toBeNull();
  });

  it('desce só a caixa da conversa, sem rolar a página', async () => {
    const rolarPagina = vi.fn();
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    const alturaOriginal = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
    const topoOriginal = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
    const topos: number[] = [];
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: rolarPagina });
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 900 });
    Object.defineProperty(Element.prototype, 'scrollTop', { configurable: true, get: () => 0, set: (v: number) => { topos.push(v); } });
    try {
      s.getMessages.mockResolvedValue([msg('1', 'incoming', 'Oi, tudo bem?')]);
      render(<ConversaAoVivo conversationId="c1" />);
      await screen.findByText('Oi, tudo bem?');
      expect(rolarPagina).not.toHaveBeenCalled();
      expect(topos).toContain(900);
    } finally {
      if (original) Object.defineProperty(Element.prototype, 'scrollIntoView', original);
      else delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView;
      if (alturaOriginal) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', alturaOriginal);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollHeight;
      if (topoOriginal) Object.defineProperty(Element.prototype, 'scrollTop', topoOriginal);
    }
  });
});
