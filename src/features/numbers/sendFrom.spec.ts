import { describe, it, expect } from 'vitest';
import {
  SEND_FROM_AUTO, SEND_FROM_FOLLOWUP_DEFAULT, SEND_FROM_LABEL, SEND_FROM_LOAD_FAILED, SEND_FROM_NEEDS_NUMBER,
  SEND_FROM_OWNER, SEND_FROM_SPECIFIC_GROUP, applySendFrom, fromSelectValue, missingSelection, missingSelectionLabel,
  numberOptionLabel, selectValue, sendFromAutoLabel, sendFromHint, sendFromOf, sendFromProblem, sendFromWarnings,
  sendNumbersFrom, showsOwnerOption, valueForScope, type SendNumberOption,
} from './sendFrom';

// "Enviar pelo número" (fase 2b.2): o valor, a lista e as palavras da tela.
const loja: SendNumberOption = {
  inbox_id: 'i1', name: 'Loja', phone: '+5511912341234', connection: 'connected', owner: null,
};
const daAna: SendNumberOption = {
  inbox_id: 'i2', name: 'Da Ana', phone: null, connection: 'disconnected', owner: { id: 'u1', name: 'Ana' },
};

describe('sendFromOf — o valor gravado, normalizado', () => {
  // Review Focus 1: toda configuração de antes desta fase é o padrão.
  it('sem nada gravado (ou lixo) é o padrão', () => {
    expect(sendFromOf(undefined)).toEqual({ send_from: '', send_from_inbox_id: '' });
    expect(sendFromOf({})).toEqual({ send_from: '', send_from_inbox_id: '' });
    expect(sendFromOf({ send_from: 'qualquer', send_from_inbox_id: 'i1' })).toEqual({ send_from: '', send_from_inbox_id: '' });
  });

  it('o número do responsável não carrega número', () => {
    expect(sendFromOf({ send_from: 'owner', send_from_inbox_id: 'i1' })).toEqual({ send_from: 'owner', send_from_inbox_id: '' });
  });

  it('um número específico carrega o número', () => {
    expect(sendFromOf({ send_from: 'number', send_from_inbox_id: ' i1 ' })).toEqual({ send_from: 'number', send_from_inbox_id: 'i1' });
    expect(sendFromOf({ send_from: 'number', send_from_inbox_id: '  ' })).toEqual({ send_from: '', send_from_inbox_id: '' });
  });
});

describe('o valor do seletor', () => {
  it('vai e volta sem perder nada', () => {
    for (const v of [
      { send_from: '' as const, send_from_inbox_id: '' },
      { send_from: 'owner' as const, send_from_inbox_id: '' },
      { send_from: 'number' as const, send_from_inbox_id: 'i2' },
    ]) {
      expect(fromSelectValue(selectValue(v))).toEqual(v);
    }
  });

  it('valor desconhecido vira o padrão', () => {
    expect(fromSelectValue('number:')).toEqual({ send_from: '', send_from_inbox_id: '' });
    expect(fromSelectValue('xyz')).toEqual({ send_from: '', send_from_inbox_id: '' });
  });
});

describe('cada tela tem o seu padrão (E37)', () => {
  it('automação: "Automático (como sempre foi)" e a opção do responsável à parte', () => {
    expect(sendFromAutoLabel('lead_automation_rules')).toBe(SEND_FROM_AUTO);
    expect(showsOwnerOption('lead_automation_rules')).toBe(true);
  });

  it('funil: o padrão JÁ é o número do responsável, sem opção repetida', () => {
    expect(sendFromAutoLabel('followup_sequences')).toBe('O número do responsável pelo lead (padrão)');
    expect(showsOwnerOption('followup_sequences')).toBe(false);
    expect(valueForScope({ send_from: 'owner', send_from_inbox_id: '' }, 'followup_sequences'))
      .toEqual({ send_from: '', send_from_inbox_id: '' });
    expect(valueForScope({ send_from: 'owner', send_from_inbox_id: '' }, 'lead_automation_rules'))
      .toEqual({ send_from: 'owner', send_from_inbox_id: '' });
  });

  it('a explicação do padrão do funil diz o que acontece sem responsável', () => {
    expect(sendFromHint('', 'followup_sequences')).toBe(
      'Sai pelo número do responsável pelo lead (o principal, se houver mais de um). ' +
      'Se o lead já conversa num número em que o responsável pelo lead atende, a conversa continua nele. ' +
      'Lead sem responsável, ou responsável sem número, sai como antes: pelo número da conversa do lead.',
    );
    expect(sendFromHint('number', 'followup_sequences')).toContain('Sai sempre por este número.');
  });
});

describe('applySendFrom — os params da ação', () => {
  // E26: com escolha, a "Instância de envio (admin)" sai da ação.
  it('escolher um número tira a instância do admin', () => {
    const params = { message: 'Oi', sender_instance: 'Operacional' };
    expect(applySendFrom(params, { send_from: 'number', send_from_inbox_id: 'i1' }))
      .toEqual({ message: 'Oi', send_from: 'number', send_from_inbox_id: 'i1' });
  });

  it('voltar ao automático mantém a instância do admin', () => {
    const params = { message: 'Oi', sender_instance: 'Operacional' };
    expect(applySendFrom(params, { send_from: '', send_from_inbox_id: '' }))
      .toEqual({ message: 'Oi', sender_instance: 'Operacional', send_from: '', send_from_inbox_id: '' });
  });
});

describe('o que a tela diz', () => {
  it('rótulos e explicações da automação', () => {
    expect(SEND_FROM_LABEL).toBe('Enviar pelo número');
    expect(SEND_FROM_AUTO).toBe('Automático (como sempre foi)');
    expect(SEND_FROM_OWNER).toBe('O número do responsável pelo lead');
    expect(SEND_FROM_SPECIFIC_GROUP).toBe('Um número específico');
    expect(sendFromHint('')).toBe('Sai pelo número da conversa do lead; lead sem conversa sai pelo número que o sistema escolher.');
    expect(sendFromHint('owner')).toContain('Lead sem responsável sai como no automático.');
    expect(sendFromHint('number')).toContain('a conversa continua nele');
  });

  it('a linha de cada número: telefone, conexão fora do normal e — com a regra — o dono', () => {
    expect(numberOptionLabel(loja, true)).toBe('Loja · (11) 91234-1234');
    expect(numberOptionLabel(daAna, true)).toBe('Da Ana · desconectado · de Ana');
    expect(numberOptionLabel(daAna, false)).toBe('Da Ana · desconectado');
  });

  // Review Focus 2.
  it('número escolhido que sumiu da lista', () => {
    expect(missingSelection({ send_from: 'number', send_from_inbox_id: 'apagado' }, [loja])).toBe(true);
    expect(missingSelection({ send_from: 'number', send_from_inbox_id: 'i1' }, [loja])).toBe(false);
    expect(missingSelection({ send_from: 'owner', send_from_inbox_id: '' }, [])).toBe(false);
    expect(missingSelectionLabel('loaded')).toBe('Número que não existe mais — escolha outro');
    expect(missingSelectionLabel('failed')).toBe('O número escolhido antes (a lista não carregou)');
    expect(missingSelectionLabel('loading')).toBe('Carregando os números…');
  });

  it('"um número específico" sem número não salva', () => {
    expect(sendFromProblem({ send_from: 'number', send_from_inbox_id: '' })).toBe(SEND_FROM_NEEDS_NUMBER);
    expect(sendFromProblem({ send_from: 'number', send_from_inbox_id: 'i1' })).toBeNull();
    expect(sendFromProblem({ send_from: '', send_from_inbox_id: '' })).toBeNull();
  });

  it('fala número, nunca instância, inbox ou caixa de entrada', () => {
    const textos = [
      SEND_FROM_LABEL, SEND_FROM_AUTO, SEND_FROM_FOLLOWUP_DEFAULT, SEND_FROM_OWNER, SEND_FROM_SPECIFIC_GROUP,
      SEND_FROM_NEEDS_NUMBER, SEND_FROM_LOAD_FAILED, sendFromHint(''), sendFromHint('owner'), sendFromHint('number'),
      sendFromHint('', 'followup_sequences'), missingSelectionLabel('loaded'), missingSelectionLabel('failed'),
      missingSelectionLabel('loading'),
    ];
    for (const t of textos) expect(t).not.toMatch(/instância|inbox|caixa de entrada/i);
  });

  // F8 do pré-voo: a explicação nunca usa "ele"/"dele" para a pessoa responsável.
  it('neutro de gênero: nunca "ele" nem "dele" pela pessoa responsável', () => {
    const textos = [
      sendFromHint(''), sendFromHint('owner'), sendFromHint('number'),
      sendFromHint('', 'followup_sequences'), sendFromHint('number', 'followup_sequences'),
    ];
    for (const t of textos) expect(t).not.toMatch(/\bele\b|\bdele\b/i);
  });
});

describe('o que vem do servidor', () => {
  it('lista malformada vira lista vazia, sem a regra', () => {
    expect(sendNumbersFrom(null)).toEqual({ number_owner_rule: false, numbers: [] });
    expect(sendNumbersFrom({ number_owner_rule: true, numbers: [loja] })).toEqual({ number_owner_rule: true, numbers: [loja] });
  });

  it('os avisos do salvar: só textos de verdade', () => {
    expect(sendFromWarnings({ send_from_warnings: ['O número Loja…', '', 3] })).toEqual(['O número Loja…']);
    expect(sendFromWarnings({})).toEqual([]);
    expect(sendFromWarnings(null)).toEqual([]);
  });
});
