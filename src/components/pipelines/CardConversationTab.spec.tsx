// Card do lead → aba Conversa: falha ao ler as mensagens não pode virar
// "Nenhuma mensagem ainda." (o corretor concluiria que nunca falou com o lead).
// 404 é vazio honesto; outra falha com a lista vazia é erro com Tentar de novo;
// a releitura de fundo (8 em 8 s) que falha com mensagens na tela fica calada.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const getMessages = vi.hoisted(() => vi.fn());
vi.mock('@/services/conversations/conversationService', () => ({
  conversationAPI: { getMessages, sendMessage: vi.fn() },
}));
vi.mock('@/services/chat/chatService', () => ({
  chatService: { archiveConversation: vi.fn(), unarchiveConversation: vi.fn() },
}));
vi.mock('@/components/chat/message-funnels/DispararFunilPanel', () => ({ DispararFunilPanel: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import CardConversationTab from './CardConversationTab';
import type { PipelineItem } from '@/types/analytics';

const item = { id: 'i1', item_id: 'c-10', type: 'conversation', conversation: { id: 10 } } as unknown as PipelineItem;

const msg = (id: number, content: string) => ({
  id, content, message_type: 0, created_at: 1_760_000_000, attachments: [], sender: { name: 'Ana' },
});

const falha = (status: number) => Object.assign(new Error(String(status)), { response: { status } });

beforeEach(() => {
  getMessages.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.useRealTimers());

describe('Card do lead → Conversa · erro de carga', () => {
  it('(a) primeira carga que falha com 500 mostra Tentar de novo, não "Nenhuma mensagem ainda."', async () => {
    getMessages.mockRejectedValue(falha(500));
    render(<CardConversationTab item={item} />);
    const botao = await screen.findByRole('button', { name: 'Tentar de novo' });
    expect(screen.queryByText('Nenhuma mensagem ainda.')).toBeNull();

    getMessages.mockResolvedValue([msg(1, 'Oi, tudo bem?')]);
    await userEvent.click(botao);
    expect(await screen.findByText('Oi, tudo bem?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
  });

  it('(b) 404 é vazio honesto: "Nenhuma mensagem ainda."', async () => {
    getMessages.mockRejectedValue(falha(404));
    render(<CardConversationTab item={item} />);
    expect(await screen.findByText('Nenhuma mensagem ainda.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
  });

  it('(c) releitura de fundo que falha com mensagens na tela: as mensagens ficam e nenhum erro aparece', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getMessages.mockResolvedValueOnce([msg(1, 'Primeira'), msg(2, 'Segunda')]);
    render(<CardConversationTab item={item} />);
    expect(await screen.findByText('Primeira')).toBeInTheDocument();

    getMessages.mockRejectedValue(falha(500));
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });
    expect(getMessages).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Primeira')).toBeInTheDocument();
    expect(screen.getByText('Segunda')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
    expect(screen.queryByText('Não deu pra carregar')).toBeNull();
  });
});
