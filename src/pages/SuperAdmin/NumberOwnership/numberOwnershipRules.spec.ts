import { describe, it, expect } from 'vitest';
import type { OwnershipDiagnosis } from '@/services/superAdmin/numberOwnershipService';
import {
  FAILED_REQUEST_MESSAGE, connectionText, liberatedLine, ownerSourceText, roletaLine, sortRows, summaryLine,
  verdictBadge, type TenantRow,
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
