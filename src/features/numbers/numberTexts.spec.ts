import { describe, it, expect } from 'vitest';
import {
  CHANGE_IN_CHANNELS, CONNECTION_NOTE, LIBERATED_TITLE, MAKE_PRIMARY, MY_NUMBERS_DESCRIPTION, NOTICE_PHONE_LABEL, NO_AI,
  NO_OWNED_NUMBERS_OTHER, NO_OWNED_NUMBERS_SELF, NO_PHONE, NO_ROLETA, NUMBERS_COLUMN, NUMBERS_TITLE, OWNER_EXPLANATION,
  OWNER_TITLE, PRIMARY_DONE, PRIMARY_FAILED, PRIMARY_HINT_OTHER, PRIMARY_HINT_SELF, PRINCIPAL, SHARED_LABEL, connectionLabel, formatPhone, liberatedSummary, numberRuleLine, numbersColumnText, ownedNumberLine,
  ownerLine, ownerLockProblem, ownerLockText, withOwner,
} from './numberTexts';
import type { OwnedNumber } from './types';

// Os textos do DONO DO NÚMERO (fase 2b.1) moram aqui, fora do JSX, porque são
// a promessa que a tela faz ao gestor: "quem escreve neste número vai direto
// pro dono". Dita num cliente sem a regra, ou com o dono errado, a tela mente.

const numero = (over: Partial<OwnedNumber> = {}): OwnedNumber => ({
  inbox_id: 'i1', name: 'WhatsApp da Ana', phone: '+5511912341234', connection: 'connected', principal: true, ...over,
});

describe('os textos fixos da spec', () => {
  it('saem exatamente como a spec escreveu', () => {
    expect(OWNER_TITLE).toBe('Dono do número');
    expect(OWNER_EXPLANATION).toBe(
      'Quem escreve neste número vai direto pro dono. Sem dono, o número é da imobiliária e quem escreve entra na roleta.',
    );
    expect(SHARED_LABEL).toBe('Da imobiliária (compartilhado)');
    expect(NUMBERS_TITLE).toBe('Números de atendimento');
    expect(PRINCIPAL).toBe('Principal');
    expect(CHANGE_IN_CHANNELS).toBe('alterar em Canais');
    expect(NOTICE_PHONE_LABEL).toBe('Celular para avisos');
    expect(NUMBERS_COLUMN).toBe('Números');
    expect(LIBERATED_TITLE).toBe('Números liberados');
  });
});

describe('formatPhone', () => {
  it('telefone brasileiro com 9 dígitos vira (11) 91234-1234', () => {
    expect(formatPhone('+5511912341234')).toBe('(11) 91234-1234');
    expect(formatPhone('5511912341234')).toBe('(11) 91234-1234');
  });

  it('fixo com 8 dígitos e número sem o 55', () => {
    expect(formatPhone('+551133334444')).toBe('(11) 3333-4444');
    expect(formatPhone('11912341234')).toBe('(11) 91234-1234');
  });

  it('o que não reconhece volta como veio; vazio vira vazio', () => {
    expect(formatPhone('+14155552671')).toBe('+14155552671');
    expect(formatPhone(null)).toBe('');
    expect(formatPhone(undefined)).toBe('');
  });
});

describe('connectionLabel', () => {
  it('o estado gravado em português', () => {
    expect(connectionLabel('connected')).toBe('conectado');
    expect(connectionLabel('connecting')).toBe('conectando');
    expect(connectionLabel('disconnected')).toBe('desconectado');
    expect(connectionLabel('unknown')).toBe('sem estado gravado');
  });
});

describe('ownerLine — de quem é o número, no cartão de Canais', () => {
  const ana = { id: 'u1', name: 'Ana', active: true };

  it('com a regra: o dono pelo nome', () => {
    expect(ownerLine({ number_owner_rule: true, owner: ana, shared: false })).toBe('Ana');
  });

  it('com a regra: sem dono é da imobiliária', () => {
    expect(ownerLine({ number_owner_rule: true, owner: null, shared: true })).toBe('Da imobiliária (compartilhado)');
  });

  // Review Focus 1 / G2: dono desativado não é dono — o lead vai para a
  // roleta, e a tela diz por quê em vez de mostrar o nome de quem saiu como
  // se valesse. Texto neutro de gênero: "o cadastro de Ana está desativado".
  it('com a regra: dono desativado vale como da imobiliária, com o motivo', () => {
    expect(ownerLine({ number_owner_rule: true, owner: { ...ana, active: false }, shared: true }))
      .toBe('Da imobiliária (compartilhado) — o cadastro de Ana está desativado');
  });

  it('com a regra: dono ativo que o servidor não aceita (conta da Leal Mídia) também', () => {
    expect(ownerLine({ number_owner_rule: true, owner: { id: 'u9', name: 'Suporte LM', active: true }, shared: true }))
      .toBe('Da imobiliária (compartilhado) — Suporte LM é conta da Leal Mídia');
  });

  it('sem a regra: só o nome gravado, sem prometer nada', () => {
    expect(ownerLine({ number_owner_rule: false, owner: ana, shared: true })).toBe('Ana');
    expect(ownerLine({ number_owner_rule: false, owner: null, shared: true })).toBe('ninguém');
  });
});

describe('numberRuleLine e a trava da roleta (neutro de gênero, E10)', () => {
  it('número de alguém e número da imobiliária', () => {
    expect(numberRuleLine({ id: 'u1', name: 'Fulano' })).toBe('Número de Fulano: quem escreve nele vai direto pra Fulano');
    expect(numberRuleLine(null)).toBe('Número da imobiliária: quem escreve entra na roleta');
  });

  it('a trava diz o caminho', () => {
    expect(ownerLockText('Fulano')).toBe('Este número é de Fulano. Pra dividir, tire o dono em Canais.');
  });

  it('a recusa do formulário é a MESMA frase do servidor', () => {
    expect(ownerLockProblem('Vendas 01', 'Fulano')).toBe('Este número (Vendas 01) é de Fulano. Pra dividir, tire o dono em Canais.');
  });
});

describe('a coluna Números da Equipe', () => {
  const semAcesso = { sees_all_inboxes: false, granted_inbox_ids: [], auto_inbox_ids: [] };

  it('com a regra e um número: "(11) 91234-1234 · Principal"', () => {
    expect(numbersColumnText({ ...semAcesso, numbers: [numero()] }, true)).toBe('(11) 91234-1234 · Principal');
  });

  it('com a regra e vários: o principal e quantos mais', () => {
    const lista = [numero(), numero({ inbox_id: 'i2', phone: '+5511900001111', principal: false })];
    expect(numbersColumnText({ ...semAcesso, numbers: lista }, true)).toBe('(11) 91234-1234 · Principal (+1)');
  });

  it('sem a regra, ou sem número próprio: os liberados, contados por origem', () => {
    const m = { sees_all_inboxes: false, granted_inbox_ids: ['a'], auto_inbox_ids: ['b', 'c'], numbers: [numero()] };
    expect(numbersColumnText(m, false)).toBe('1 liberado · 2 automáticos');
    expect(numbersColumnText({ ...semAcesso, numbers: [] }, true)).toBe('Nenhum');
    expect(liberatedSummary({ sees_all_inboxes: true, granted_inbox_ids: [], auto_inbox_ids: [] })).toBe('Todos');
    expect(liberatedSummary({ sees_all_inboxes: false, granted_inbox_ids: ['a', 'b'], auto_inbox_ids: [] }))
      .toBe('2 liberados');
  });

  it('número sem telefone gravado aparece pelo nome', () => {
    expect(ownedNumberLine(numero({ phone: null, principal: false }))).toBe('WhatsApp da Ana');
  });
});

describe('withOwner — o dono do número nunca sai da lista de Colaboradores', () => {
  it('põe o dono quando falta, e não duplica', () => {
    expect(withOwner(['u2'], 'u1')).toEqual(['u2', 'u1']);
    expect(withOwner(['u1', 'u2'], 'u1')).toEqual(['u1', 'u2']);
    expect(withOwner(['u2'], null)).toEqual(['u2']);
  });
});

describe('linguagem da tela', () => {
  it('nenhum texto fala instância, inbox ou caixa de entrada', () => {
    const textos = [
      OWNER_TITLE, OWNER_EXPLANATION, SHARED_LABEL, NUMBERS_TITLE, NUMBERS_COLUMN, LIBERATED_TITLE, PRINCIPAL,
      MAKE_PRIMARY, CHANGE_IN_CHANNELS, NOTICE_PHONE_LABEL, PRIMARY_HINT_SELF, PRIMARY_HINT_OTHER,
      NO_OWNED_NUMBERS_SELF, NO_OWNED_NUMBERS_OTHER, MY_NUMBERS_DESCRIPTION, PRIMARY_DONE, PRIMARY_FAILED, NO_PHONE,
      NO_ROLETA, NO_AI, CONNECTION_NOTE,
      numberRuleLine(null), numberRuleLine({ id: 'u', name: 'X' }), ownerLockText('X'), ownerLockProblem('Y', 'X'),
      ownerLine({ number_owner_rule: true, owner: null, shared: true }),
      liberatedSummary({ sees_all_inboxes: false, granted_inbox_ids: [], auto_inbox_ids: [] }),
      ...(['connected', 'connecting', 'disconnected', 'unknown'] as const).map(connectionLabel),
    ];
    for (const texto of textos) expect(texto).not.toMatch(/instância|inbox|caixa de entrada/i);
  });
});
