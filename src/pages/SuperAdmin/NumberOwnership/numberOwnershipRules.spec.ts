import { describe, it, expect } from 'vitest';
import type { OwnershipDiagnosis } from '@/services/superAdmin/numberOwnershipService';
import {
  FAILED_REQUEST_MESSAGE, RULE_FAILED_MESSAGE, conflictHint, connectionText, liberatedLine, ownerSourceText,
  roletaLine, ruleAction, ruleConfirmation, ruleDoneText, ruleErrorMessage, ruleLastLine, ruleStatusText, sortRows,
  summaryLine, verdictBadge, type TenantRow,
} from './numberOwnershipRules';

// A aba Números do painel raiz responde três perguntas: quem migra sozinho,
// quem precisa conferir e por quê. O selo e a ordem da lista são a resposta —
// errar aqui é mandar o Tony ligar a fase 2b num cliente que briga.
function diagnosis(over: Partial<OwnershipDiagnosis> = {}): OwnershipDiagnosis {
  return {
    tenant: { id: 't1', name: 'Cliente', slug: 'cliente' },
    verdict: 'migrates',
    reason: null,
    summary: { numbers: 2, owned: 1, shared: 1, needs_review: 0 },
    numbers: [],
    people: [],
    read_at: '2026-09-26T12:00:00Z',
    ...over,
  };
}

function row(name: string, state: TenantRow['state']): TenantRow {
  return { tenant: { id: name, name, slug: name.toLowerCase() }, state };
}

describe('selo do cliente', () => {
  it('migra sozinho', () => {
    expect(verdictBadge({ kind: 'ready', data: diagnosis() })).toEqual({ label: 'Migra sozinho', tone: 'ok', note: '' });
  });

  it('precisa conferir, com quantos números brigam', () => {
    const data = diagnosis({ verdict: 'needs_review', summary: { numbers: 4, owned: 1, shared: 0, needs_review: 3 } });
    expect(verdictBadge({ kind: 'ready', data })).toEqual({ label: 'Precisa conferir (3)', tone: 'warn', note: '' });
  });

  it('não consegui ler, com o motivo do servidor', () => {
    const data = diagnosis({ verdict: 'unreadable', reason: 'este cliente ainda não tem as tabelas da roleta' });
    expect(verdictBadge({ kind: 'ready', data })).toEqual({
      label: 'Não consegui ler', tone: 'error', note: 'este cliente ainda não tem as tabelas da roleta',
    });
  });

  it('pedido que falhou também é "não consegui ler", com o motivo da tela', () => {
    expect(verdictBadge({ kind: 'failed', message: FAILED_REQUEST_MESSAGE })).toEqual({
      label: 'Não consegui ler', tone: 'error', note: FAILED_REQUEST_MESSAGE,
    });
  });

  it('enquanto carrega, "lendo…"', () => {
    expect(verdictBadge({ kind: 'loading' })).toEqual({ label: 'lendo…', tone: 'neutral', note: '' });
  });
});

describe('textos do número', () => {
  it('de onde veio o dono sugerido', () => {
    expect(ownerSourceText({ source: 'responsible', source_roleta: null })).toBe('pelo Responsável');
    expect(ownerSourceText({ source: 'roleta', source_roleta: 'Vendas' })).toBe('pela roleta “Vendas”');
    expect(ownerSourceText({ source: 'liberated', source_roleta: null })).toBe('único corretor liberado');
    expect(ownerSourceText({ source: 'shared', source_roleta: null })).toBe('Compartilhado');
  });

  it('estado gravado da conexão', () => {
    expect(connectionText('connected')).toBe('conectado');
    expect(connectionText('connecting')).toBe('conectando');
    expect(connectionText('disconnected')).toBe('desconectado');
    expect(connectionText('unknown')).toBe('sem estado gravado');
  });

  it('linha de cada roleta', () => {
    expect(roletaLine({
      id: 'r1', name: 'Vendas', active: true, shared: false,
      brokers: [{ id: 'u1', name: 'Fulano', active: true }],
    })).toBe('Roleta “Vendas” · Exclusivo · Fulano');
    expect(roletaLine({ id: 'r2', name: 'Antiga', active: false, shared: true, brokers: [] }))
      .toBe('Roleta “Antiga” · Compartilhado · sem corretor · roleta desligada');
  });

  it('quem está liberado à mão, marcando gestor e desativado', () => {
    expect(liberatedLine([])).toBe('ninguém liberado à mão');
    expect(liberatedLine([
      { id: 'u1', name: 'Fulano', corretor: true, active: true },
      { id: 'u2', name: 'Gestora', corretor: false, active: true },
      { id: 'u3', name: 'Saiu', corretor: true, active: false },
    ])).toBe('Fulano, Gestora (gestor), Saiu (desativado)');
  });
});

describe('a lista de clientes', () => {
  it('quem precisa conferir vem primeiro (mais brigas antes), depois quem não deu pra ler, depois lendo, depois quem migra', () => {
    const rows = [
      row('Zeta', { kind: 'ready', data: diagnosis() }),
      row('Beta', { kind: 'loading' }),
      row('Alfa', { kind: 'ready', data: diagnosis({ verdict: 'unreadable', reason: 'x' }) }),
      row('Gama', { kind: 'ready', data: diagnosis({ verdict: 'needs_review', summary: { numbers: 2, owned: 0, shared: 0, needs_review: 1 } }) }),
      row('Delta', { kind: 'ready', data: diagnosis({ verdict: 'needs_review', summary: { numbers: 5, owned: 0, shared: 0, needs_review: 4 } }) }),
      row('Épsilon', { kind: 'failed', message: FAILED_REQUEST_MESSAGE }),
    ];
    expect(sortRows(rows).map(r => r.tenant.name)).toEqual(['Delta', 'Gama', 'Alfa', 'Épsilon', 'Beta', 'Zeta']);
  });

  it('resumo no topo, no plural e no singular', () => {
    const rows = [
      row('A', { kind: 'ready', data: diagnosis() }),
      row('B', { kind: 'ready', data: diagnosis() }),
      row('C', { kind: 'ready', data: diagnosis({ verdict: 'needs_review', summary: { numbers: 1, owned: 0, shared: 0, needs_review: 1 } }) }),
      row('D', { kind: 'failed', message: FAILED_REQUEST_MESSAGE }),
    ];
    expect(summaryLine(rows)).toBe('2 clientes migram sozinhos · 1 precisa conferir · 1 não consegui ler');
    expect(summaryLine([row('A', { kind: 'ready', data: diagnosis() }), row('B', { kind: 'loading' })]))
      .toBe('1 cliente migra sozinho · 0 precisam conferir · 0 não consegui ler · 1 lendo…');
  });
});

describe('linguagem da tela', () => {
  it('nunca fala em instância, inbox ou canal', () => {
    const textos = [
      verdictBadge({ kind: 'loading' }).label,
      verdictBadge({ kind: 'failed', message: FAILED_REQUEST_MESSAGE }).note,
      ...(['responsible', 'roleta', 'liberated', 'shared'] as const).map(source => ownerSourceText({ source, source_roleta: 'X' })),
      ...(['connected', 'connecting', 'disconnected', 'unknown'] as const).map(connectionText),
      roletaLine({ id: 'r', name: 'X', active: false, shared: true, brokers: [] }),
      liberatedLine([]),
      summaryLine([row('A', { kind: 'loading' })]),
    ];
    for (const texto of textos) expect(texto).not.toMatch(/instância|inbox|canal/i);
  });
});

// Fase 2b.1 — o botão que LIGA a regra do dono num cliente. Ligar é escrita em
// produção: o botão só existe onde o servidor sabe ligar, só fica clicável no
// "Migra sozinho", e diz o que vai acontecer antes.
describe('Ligar / Desligar dono do número', () => {
  const desligada = { enabled: false, last: null };

  it('servidor antigo (sem a regra na resposta): nenhum botão', () => {
    expect(ruleAction(diagnosis())).toBeNull();
    expect(ruleStatusText(undefined)).toBe('');
  });

  it('migra sozinho e desligada: Ligar, clicável', () => {
    expect(ruleAction(diagnosis({ rule: desligada }))).toEqual({
      kind: 'enable', label: 'Ligar dono do número', blockedReason: '',
    });
  });

  it('precisa conferir: Ligar desligado, com o caminho', () => {
    const a = ruleAction(diagnosis({ verdict: 'needs_review', rule: desligada }));
    expect(a?.kind).toBe('enable');
    expect(a?.blockedReason).toBe(
      'Precisa conferir antes: resolva cada número abaixo em Canais e na Roleta, e clique em Atualizar.',
    );
  });

  it('migra sozinho mas com número em conflito (resposta incoerente): Ligar desligado, com o caminho', () => {
    const numero = {
      inbox_id: 'i1', name: 'Do Fulano', phone: null, connection: 'unknown' as const, responsible: null,
      roletas: [], liberated: [], suggested_owner: null, source: 'shared' as const, source_roleta: null,
      phone_matches: false, conflicts: ['briga'], conflict_codes: ['support_owner'],
    };
    const a = ruleAction(diagnosis({ rule: desligada, numbers: [numero] }));
    expect(a?.kind).toBe('enable');
    expect(a?.blockedReason).not.toBe('');
  });

  it('código que é nome de propriedade do objeto não vira dica', () => {
    expect(conflictHint('toString')).toBe('');
    expect(conflictHint('constructor')).toBe('');
  });

  it('não consegui ler: nenhum botão', () => {
    expect(ruleAction(diagnosis({ verdict: 'unreadable', rule: desligada }))).toBeNull();
  });

  it('ligada: Desligar, sempre clicável (mesmo que agora precise conferir)', () => {
    const ligada = { enabled: true, last: null };
    expect(ruleAction(diagnosis({ verdict: 'needs_review', rule: ligada }))).toEqual({
      kind: 'disable', label: 'Desligar dono do número', blockedReason: '',
    });
    expect(ruleStatusText(ligada)).toBe('Dono do número: ligado');
    expect(ruleStatusText(desligada)).toBe('Dono do número: desligado');
  });

  it('o último registro, no horário do servidor (não convertido)', () => {
    expect(ruleLastLine({ action: 'enable', at: '2026-09-28T15:04:05-03:00', by: 'tony@lealmidia.com.br', changed: 3 }))
      .toBe('Ligado em 28/09/2026 15:04 por tony@lealmidia.com.br · 3 donos gravados');
    expect(ruleLastLine({ action: 'enable', at: '2026-09-28T15:04:05-03:00', by: 'x', changed: 1 }))
      .toBe('Ligado em 28/09/2026 15:04 por x · 1 dono gravado');
    expect(ruleLastLine({ action: 'disable', at: '2026-09-29T09:00:00-03:00', by: 'x', changed: 0 }))
      .toBe('Desligado em 29/09/2026 09:00 por x');
    expect(ruleLastLine(null)).toBe('');
  });

  it('a confirmação diz o que vai acontecer, com as contas do cliente', () => {
    const data = diagnosis({ summary: { numbers: 4, owned: 3, shared: 1, needs_review: 0 }, rule: desligada });
    expect(ruleConfirmation('enable', 'APTO PREMIUM', data)).toEqual({
      titulo: 'Ligar dono do número em APTO PREMIUM?',
      descricao: '3 números com dono claro ganham o dono sugerido gravado (cada dono fica liberado no número dele) '
        + 'e a regra liga: quem escreve no número de um corretor vai direto pra ele; o número sem dono é da '
        + 'imobiliária e entra na roleta. Dá para desligar depois, e os donos ficam gravados.',
      rotuloDaAcao: 'Ligar',
      destrutivo: false,
    });
    expect(ruleConfirmation('disable', 'APTO PREMIUM', data)).toMatchObject({
      titulo: 'Desligar dono do número em APTO PREMIUM?', rotuloDaAcao: 'Desligar', destrutivo: true,
    });
  });

  it('o aviso depois do clique conta o que o servidor gravou', () => {
    const data = diagnosis({ rule: { enabled: true, last: { action: 'enable', at: '2026-09-28T15:04:05-03:00', by: 'x', changed: 2 } } });
    expect(ruleDoneText('enable', 'APTO PREMIUM', data)).toBe('Dono do número ligado em APTO PREMIUM: 2 donos gravados.');
    expect(ruleDoneText('disable', 'APTO PREMIUM', data))
      .toBe('Dono do número desligado em APTO PREMIUM. Os donos continuam gravados em Canais.');
  });

  it('a recusa do servidor aparece com o motivo dele, nos dois formatos de erro', () => {
    expect(ruleErrorMessage({ response: { data: { error: 'Este cliente precisa conferir 1 número antes de ligar.' } } }))
      .toBe('Este cliente precisa conferir 1 número antes de ligar.');
    expect(ruleErrorMessage({ response: { data: { error: { message: 'Seu cargo não permite.' } } } }))
      .toBe('Seu cargo não permite.');
    expect(ruleErrorMessage(new Error('Network Error'))).toBe(RULE_FAILED_MESSAGE);
  });

  it('cada código de conflito tem o caminho para resolver; código desconhecido não inventa', () => {
    expect(conflictHint('support_owner')).toBe('Tire a conta da Leal Mídia do Dono do número em Canais.');
    expect(conflictHint('responsible_on_shared'))
      .toBe('Tire o Dono do número em Canais (o número segue dividido) ou deixe só ele na roleta.');
    expect(conflictHint('codigo_que_nao_existe')).toBe('');
    for (const code of [
      'responsible_missing', 'responsible_vs_roleta', 'exclusive_no_broker', 'exclusive_many_brokers',
      'exclusive_and_shared', 'exclusive_two_roletas', 'shared_single_broker', 'responsible_on_shared',
      'no_roleta_many_liberated', 'owner_deactivated', 'support_owner',
    ]) {
      expect(conflictHint(code)).not.toBe('');
      expect(conflictHint(code)).not.toMatch(/instância|inbox|canal\b/i);
    }
  });
});
