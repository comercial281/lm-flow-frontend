import { describe, it, expect } from 'vitest';
import {
  blockingReason,
  buildDeactivatePayload,
  canDeactivate,
  canOfferDisconnect,
  transferCandidates,
} from './deactivationRules';
import type { DeactivationPreview, User } from '@/types/users';

const user = (over: Partial<User> = {}): User =>
  ({
    id: 'u1',
    name: 'Fulano',
    email: 'f@x.com',
    availability: 'online',
    confirmed: true,
    created_at: '',
    updated_at: '',
    permissions: [],
    chave_role: 'agent',
    ...over,
  }) as User;

const preview = (over: Partial<DeactivationPreview> = {}): DeactivationPreview => ({
  leads: 0,
  open_conversations: 0,
  pending_offers: 0,
  roletas: [],
  exclusive_number: null,
  shared_numbers: [],
  ...over,
});

describe('a opção de desconectar o WhatsApp', () => {
  // Num número compartilhado, desconectar derruba o WhatsApp da imobiliária
  // inteira — a tela nem deve oferecer.
  it('não é oferecida sem número exclusivo', () => {
    expect(canOfferDisconnect(preview())).toBe(false);
  });

  it('é oferecida quando ele tem número exclusivo', () => {
    expect(canOfferDisconnect(preview({ exclusive_number: { inbox_id: 'i1', name: 'Ricardo' } }))).toBe(true);
  });

  // A caixa pode ter ficado marcada de uma abertura anterior da janela.
  it('não viaja marcada quando não havia número exclusivo', () => {
    const payload = buildDeactivatePayload(
      { reason: 'saiu', transferToId: 'u2', disconnectNumber: true },
      preview(),
    );

    expect(payload.disconnect_number).toBe(false);
  });
});

describe('a trava do número desconectado', () => {
  // Número desconectado não recebe mensagem: o lead que responder na conversa
  // antiga cai no vazio.
  it('exige destino para os leads quando há carteira', () => {
    const motivo = blockingReason(
      { reason: 'saiu', transferToId: null, disconnectNumber: true },
      preview({ leads: 47, exclusive_number: { inbox_id: 'i1' } }),
    );

    expect(motivo).toContain('quem fica com os leads');
  });

  // Cobrar destino de quem não tem lead nenhum seria pergunta sem resposta.
  it('não cobra destino quando não há carteira', () => {
    const motivo = blockingReason(
      { reason: 'saiu', transferToId: null, disconnectNumber: true },
      preview({ exclusive_number: { inbox_id: 'i1' } }),
    );

    expect(motivo).toBeNull();
  });

  it('libera quando o destino foi escolhido', () => {
    const motivo = blockingReason(
      { reason: 'saiu', transferToId: 'u2', disconnectNumber: true },
      preview({ leads: 47, exclusive_number: { inbox_id: 'i1' } }),
    );

    expect(motivo).toBeNull();
  });

  // Deixar a carteira como está continua sendo escolha legítima — ela só não
  // convive com desconectar o número.
  it('deixa desativar sem destino quando o número não é desconectado', () => {
    const motivo = blockingReason(
      { reason: 'ferias', transferToId: null, disconnectNumber: false },
      preview({ leads: 47 }),
    );

    expect(motivo).toBeNull();
  });
});

describe('para quem a carteira pode ir', () => {
  it('não oferece a própria pessoa que está saindo', () => {
    const saindo = user({ id: 'u1' });
    const lista = transferCandidates([saindo, user({ id: 'u2' })], saindo);

    expect(lista.map(u => u.id)).toEqual(['u2']);
  });

  // Passar a carteira para alguém desativado é trocar um silêncio por outro.
  it('não oferece quem já está desativado', () => {
    const lista = transferCandidates(
      [user({ id: 'u2' }), user({ id: 'u3', deactivated: true })],
      user({ id: 'u1' }),
    );

    expect(lista.map(u => u.id)).toEqual(['u2']);
  });
});

describe('quem pode desativar quem', () => {
  it('o gestor desativa corretor', () => {
    expect(canDeactivate(user({ id: 'g', chave_role: 'manager' }), user({ chave_role: 'agent' }))).toBe(true);
  });

  it('o gestor NÃO desativa outro gestor', () => {
    expect(canDeactivate(user({ id: 'g', chave_role: 'manager' }), user({ chave_role: 'manager' }))).toBe(false);
  });

  it('o administrador desativa qualquer um', () => {
    expect(canDeactivate(user({ id: 'a', chave_role: 'admin' }), user({ chave_role: 'manager' }))).toBe(true);
  });

  it('ninguém desativa o próprio acesso', () => {
    const eu = user({ id: 'a', chave_role: 'admin' });
    expect(canDeactivate(eu, eu)).toBe(false);
  });
});
