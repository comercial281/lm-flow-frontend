import { describe, it, expect } from 'vitest';
import { esperaDoLead, horaDoItem, camposDaConversaAoAtualizar } from './itemDaLista';
import type { Conversation, Message } from '@/types/chat/api';

const agora = new Date(2026, 9, 2, 12, 0, 0);
const seg = (d: Date) => Math.floor(d.getTime() / 1000);
const ultima = (tipo: unknown, id = 'm1', created = new Date(2026, 9, 2, 9, 0, 0).toISOString()) =>
  ({ id, content: 'oi', message_type: tipo, created_at: created, processed_message_content: 'oi', sender: { id: '1', name: 'Ana', type: 'contact' } }) as unknown as Conversation['last_non_activity_message'];

describe('esperaDoLead', () => {
  const base = { status: 'open', waiting_since: seg(new Date(2026, 9, 2, 9, 0, 0)), last_non_activity_message: ultima('incoming') } as Pick<Conversation, 'status' | 'waiting_since' | 'last_non_activity_message'>;
  it('lead escreveu por último: mostra o texto', () => {
    expect(esperaDoLead(base, agora)).toBe('sem resposta há 3 h');
    expect(esperaDoLead({ ...base, last_non_activity_message: ultima(0) }, agora)).toBe('sem resposta há 3 h');
  });
  it('equipe ou IA respondeu por último: null', () => {
    expect(esperaDoLead({ ...base, last_non_activity_message: ultima(1) }, agora)).toBeNull();
    expect(esperaDoLead({ ...base, last_non_activity_message: ultima('outgoing') }, agora)).toBeNull();
  });
  it('sem waiting_since ou resolvida: null', () => {
    expect(esperaDoLead({ ...base, waiting_since: 0 }, agora)).toBeNull();
    expect(esperaDoLead({ ...base, status: 'resolved' }, agora)).toBeNull();
  });
});

describe('horaDoItem', () => {
  it('usa a data da última mensagem de verdade', () => {
    const d = new Date(2026, 9, 2, 9, 0, 0);
    expect(horaDoItem({ timestamp: 1, last_non_activity_message: ultima('incoming', 'm1', d.toISOString()) })).toBe(seg(d));
  });
  it('sem ela, cai no timestamp da conversa', () => {
    expect(horaDoItem({ timestamp: 1234, last_non_activity_message: null })).toBe(1234);
    expect(horaDoItem({ timestamp: 1234 })).toBe(1234);
  });
});

describe('camposDaConversaAoAtualizar', () => {
  const conv = { id: 1, timestamp: 1000, last_activity_at: 'x', last_non_activity_message: ultima('incoming', 'm1') } as unknown as Conversation;
  const msg = (over: Partial<Message>) => ({ id: 'm1', conversation_id: 1, content: 'editada', message_type: 'incoming', created_at: '2020-01-01T00:00:00Z', ...over }) as unknown as Message;
  it('atualização de mensagem antiga não muda a conversa', () => {
    expect(camposDaConversaAoAtualizar(conv, msg({ id: 'antiga' }))).toBeNull();
  });
  it('mensagem de atividade não muda a conversa', () => {
    expect(camposDaConversaAoAtualizar(conv, msg({ message_type: 'activity' }))).toBeNull();
  });
  it('atualização da última mexe só na prévia, nunca no timestamp', () => {
    const r = camposDaConversaAoAtualizar(conv, msg({}))!;
    expect(r.timestamp).toBe(1000);
    expect(r.last_activity_at).toBe('x');
    expect(r.last_non_activity_message?.content).toBe('editada');
    expect(r.last_non_activity_message?.created_at).toBe(conv.last_non_activity_message!.created_at);
  });
});
