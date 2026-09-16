import { describe, it, expect } from 'vitest';
import {
  LAST_ADMIN_REFUSAL,
  ROLE_REFUSAL,
  SELF_REFUSAL,
  blockingReason,
  buildDeactivatePayload,
  canDeactivate,
  canOfferDisconnect,
  deactivationRefusal,
  isLastActiveAdmin,
  resolveActor,
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

// A Leal Mídia é administradora de TODO CRM e fica escondida da lista da equipe
// de propósito (senão receberia aviso de lead de toda imobiliária). Procurar quem
// clicou só na lista fazia o clicador sumir — e o botão *Desativar* nascia
// desligado justamente para quem pode tudo. Foi o defeito do dia da estreia.
describe('quem está clicando', () => {
  const equipe = [
    user({ id: 'g', name: 'Gestora', chave_role: 'manager' }),
    user({ id: 'c', name: 'Corretor', chave_role: 'agent' }),
  ];

  it('vem da lista da equipe quando a pessoa está nela', () => {
    expect(resolveActor('g', equipe)?.id).toBe('g');
  });

  it('a Leal Mídia entra como administradora mesmo fora da lista', () => {
    const actor = resolveActor('super-1', equipe, { isPlatformOwner: true, name: 'Giovani' });

    expect(actor?.chave_role).toBe('admin');
    expect(canDeactivate(actor, user({ chave_role: 'manager' }))).toBe(true);
  });

  it('quem não está na lista e não é a Leal Mídia continua sendo NÃO', () => {
    expect(resolveActor('desconhecido', equipe)).toBeNull();
  });

  it('sem ninguém logado não há clicador', () => {
    expect(resolveActor(null, equipe, { isPlatformOwner: true })).toBeNull();
  });
});

// A proteção do último administrador contava só quem está NA LISTA — e a Leal
// Mídia fica fora dela. No cliente com um administrador só (a maioria), NINGUÉM
// conseguia desativá-lo, nem a Leal Mídia, e o botão ainda dizia "seu cargo não
// permite". Relato do dono do produto em 2026-09-16.
describe('o último administrador', () => {
  const dono = user({ id: 'dono', name: 'Dono', chave_role: 'admin' });
  const gestora = user({ id: 'g', name: 'Gestora', chave_role: 'manager' });
  const equipe = [dono, gestora];

  it('é protegido quando quem clica é da própria equipe', () => {
    expect(isLastActiveAdmin(dono, equipe)).toBe(true);
  });

  it('NÃO é protegido quando quem clica é a Leal Mídia: ela é administradora de todo CRM', () => {
    expect(isLastActiveAdmin(dono, equipe, { actorIsPlatformOwner: true })).toBe(false);
  });

  it('deixa de ser o último quando há outro administrador ATIVO', () => {
    const outro = user({ id: 'a2', name: 'Outro', chave_role: 'admin' });
    expect(isLastActiveAdmin(dono, [...equipe, outro])).toBe(false);
  });

  it('administrador desativado não conta como reserva', () => {
    const fora = user({ id: 'a2', name: 'Fora', chave_role: 'admin', deactivated: true });
    expect(isLastActiveAdmin(dono, [...equipe, fora])).toBe(true);
  });

  it('quem não é administrador nunca é "o último administrador"', () => {
    expect(isLastActiveAdmin(gestora, [gestora])).toBe(false);
  });
});

// A tela mostrava "seu cargo não permite" para TODO bloqueio. Quem lia isso
// como administrador ia procurar o problema no cargo — e o problema era outro.
describe('o motivo de o botão Desativar estar desligado', () => {
  const dono = user({ id: 'dono', name: 'Dono', chave_role: 'admin' });
  const gestora = user({ id: 'g', name: 'Gestora', chave_role: 'manager' });
  const corretor = user({ id: 'c', name: 'Corretor', chave_role: 'agent' });
  const equipe = [dono, gestora, corretor];

  it('null quando pode', () => {
    expect(deactivationRefusal(dono, corretor, equipe)).toBeNull();
    expect(deactivationRefusal(gestora, corretor, equipe)).toBeNull();
  });

  it('diz que é o próprio acesso', () => {
    expect(deactivationRefusal(dono, dono, equipe)).toBe(SELF_REFUSAL);
  });

  it('diz que é o cargo quando é o cargo', () => {
    expect(deactivationRefusal(gestora, dono, equipe)).toBe(ROLE_REFUSAL);
    expect(deactivationRefusal(null, dono, equipe)).toBe(ROLE_REFUSAL);
  });

  it('diz que é o último administrador quando é isso', () => {
    const outroAdmin = user({ id: 'a2', name: 'Outro', chave_role: 'admin' });
    // Dois administradores ativos na lista: um desativa o outro, sobra um.
    expect(deactivationRefusal(outroAdmin, dono, [...equipe, outroAdmin])).toBeNull();
    // Na lista só o dono é administrador ativo: a frase é a do último, não a do cargo.
    expect(deactivationRefusal(outroAdmin, dono, equipe)).toBe(LAST_ADMIN_REFUSAL);
  });

  it('a Leal Mídia desativa o único administrador do cliente', () => {
    const lealMidia = resolveActor('super-1', equipe, { isPlatformOwner: true, name: 'Giovani' });
    expect(deactivationRefusal(lealMidia, dono, equipe, { actorIsPlatformOwner: true })).toBeNull();
  });
});
