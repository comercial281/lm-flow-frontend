import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import ConversaAoVivo from './ConversaAoVivo';

const s = vi.hoisted(() => ({ getMessages: vi.fn() }));
vi.mock('@/services/conversations/conversationService', () => ({
  conversationAPI: { getMessages: s.getMessages },
}));
vi.mock('@/components/chat/messages/MessageAudio', () => ({ default: () => <div data-testid="audio" /> }));

const msg = (id: string, type: 'incoming' | 'outgoing', content: string, attachments: unknown[] = []) => ({
  id, content, message_type: type, created_at: Number(id), attachments, status: 'sent', sender: { name: 'x' },
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
});
