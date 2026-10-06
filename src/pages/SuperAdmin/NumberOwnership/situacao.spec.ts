import { describe, it, expect } from 'vitest';
import type { ConnectionSummary, OwnershipDiagnosis } from '@/services/superAdmin/numberOwnershipService';
import type { TenantRow } from './numberOwnershipRules';
import {
  contadores, filtrarSoCaidos, ordenarComCaidos, ordenarNumeros, seloDoCliente, textoDaSituacao, tomDaSituacao,
} from './situacao';

// Números conectados (entrega 4). O servidor decide a situação; aqui é palavra,
// tom e ordem. O que se protege: API oficial e nunca conectado não viram
// "caído" em lugar nenhum (o contador bate com a Atenção).
const resumo = (over: Partial<ConnectionSummary> = {}): ConnectionSummary => ({
  connected: 0, connecting: 0, down: 0, never: 0, official: 0, unknown: 0, total: 0, ...over,
});

function linha(nome: string, connectionSummary: ConnectionSummary | null, verdict: OwnershipDiagnosis['verdict'] = 'migrates'): TenantRow {
  const data: OwnershipDiagnosis = {
    tenant: { id: nome, name: nome, slug: nome },
    verdict,
    reason: null,
    summary: { numbers: 1, owned: 1, shared: 0, needs_review: verdict === 'needs_review' ? 1 : 0 },
    numbers: [],
    people: [],
    read_at: '2026-10-06T12:00:00Z',
  };
  return {
    tenant: { id: nome, name: nome, slug: nome, schema: `tenant_${nome}`, connection_summary: connectionSummary },
    state: { kind: 'ready', data },
  };
}

describe('texto da situação (a tabela da spec)', () => {
  const agora = new Date(2026, 9, 6, 16, 3);
  const desde = new Date(2026, 9, 6, 14, 3).toISOString();

  it('cada situação tem o seu texto', () => {
    expect(textoDaSituacao('connected')).toBe('Conectado');
    expect(textoDaSituacao('connecting')).toBe('Conectando…');
    expect(textoDaSituacao('disconnected', desde, agora)).toBe('Caiu há 2 h (desde 06/10 14:03)');
    expect(textoDaSituacao('never')).toBe('Nunca conectado');
    expect(textoDaSituacao('official')).toBe('API oficial · sem conexão a vigiar');
    expect(textoDaSituacao('unknown')).toBe('Não consegui ler');
  });

  it('caído sem a hora da queda (ou com hora inválida) não inventa data', () => {
    expect(textoDaSituacao('disconnected', null, agora)).toBe('Caído');
    expect(textoDaSituacao('disconnected', 'lixo', agora)).toBe('Caído');
  });

  it('só o caído é vermelho; API oficial, nunca conectado e sem leitura são neutros', () => {
    expect(tomDaSituacao('connected')).toBe('ok');
    expect(tomDaSituacao('connecting')).toBe('warn');
    expect(tomDaSituacao('disconnected')).toBe('error');
    expect(tomDaSituacao('official')).toBe('neutral');
    expect(tomDaSituacao('never')).toBe('neutral');
    expect(tomDaSituacao('unknown')).toBe('neutral');
  });
});

describe('selo do cliente', () => {
  it('sem resumo é "Sem leitura"', () => {
    expect(seloDoCliente(null)).toEqual({ texto: 'Sem leitura', tom: 'neutral' });
    expect(seloDoCliente(undefined)).toEqual({ texto: 'Sem leitura', tom: 'neutral' });
  });

  it('caído manda no selo, com plural certo', () => {
    expect(seloDoCliente(resumo({ down: 1, total: 1 }))).toEqual({ texto: '1 caído', tom: 'error' });
    expect(seloDoCliente(resumo({ down: 2, unknown: 1, total: 3 }))).toEqual({ texto: '2 caídos', tom: 'error' });
  });

  it('número sem leitura deixa o cliente "Sem leitura"', () => {
    expect(seloDoCliente(resumo({ connected: 1, unknown: 1, total: 2 }))).toEqual({ texto: 'Sem leitura', tom: 'neutral' });
  });

  it('API oficial não estraga o "Tudo conectado"', () => {
    expect(seloDoCliente(resumo({ connected: 1, official: 1, total: 2 }))).toEqual({ texto: 'Tudo conectado', tom: 'ok' });
  });

  it('só API oficial: nada a vigiar, selo neutro e não "Tudo conectado"', () => {
    expect(seloDoCliente(resumo({ official: 2, total: 2 }))).toEqual({ texto: 'Sem conexão a vigiar', tom: 'neutral' });
    // Caído e sem leitura continuam mandando.
    expect(seloDoCliente(resumo({ official: 1, down: 1, total: 2 }))).toEqual({ texto: '1 caído', tom: 'error' });
    expect(seloDoCliente(resumo({ official: 1, unknown: 1, total: 2 }))).toEqual({ texto: 'Sem leitura', tom: 'neutral' });
  });

  it('pareando e nunca conectado dizem o que é, sem "Tudo conectado"', () => {
    expect(seloDoCliente(resumo({ connected: 1, never: 1, total: 2 }))).toEqual({ texto: '1 nunca conectado', tom: 'neutral' });
    expect(seloDoCliente(resumo({ connecting: 1, never: 2, total: 3 })))
      .toEqual({ texto: '1 conectando · 2 nunca conectados', tom: 'warn' });
  });

  it('cliente sem número', () => {
    expect(seloDoCliente(resumo())).toEqual({ texto: 'Nenhum número', tom: 'neutral' });
  });
});

describe('contadores do topo', () => {
  it('soma os números de todos os clientes lidos e diz quantos clientes ficaram sem leitura', () => {
    const rows = [
      linha('Alfa', resumo({ connected: 2, total: 2 })),
      linha('Bravo', resumo({ connected: 1, down: 2, total: 3 })),
      linha('Charlie', null),
    ];
    expect(contadores(rows)).toBe('5 números · 3 conectados · 2 caídos · 0 sem leitura · 1 cliente sem leitura');
  });

  it('API oficial e nunca conectado entram no total, nunca nos caídos', () => {
    expect(contadores([linha('Alfa', resumo({ connected: 1, official: 1, never: 1, total: 3 }))]))
      .toBe('3 números · 1 conectado · 0 caídos · 0 sem leitura');
  });
});

describe('ordem e filtro', () => {
  const rows = [
    linha('Alfa', resumo({ connected: 1, total: 1 }), 'needs_review'),
    linha('Bravo', resumo({ down: 1, total: 1 })),
    linha('Charlie', resumo({ connected: 1, total: 1 })),
  ];

  it('cliente com caído sobe para o topo; o resto segue a ordem de sempre', () => {
    expect(ordenarComCaidos(rows).map((r) => r.tenant.name)).toEqual(['Bravo', 'Alfa', 'Charlie']);
  });

  it('"Só caídos" deixa só quem tem número caído', () => {
    expect(filtrarSoCaidos(rows, true).map((r) => r.tenant.name)).toEqual(['Bravo']);
    expect(filtrarSoCaidos(rows, false)).toHaveLength(3);
  });

  it('dentro do cliente, caído primeiro, sem mexer na ordem dos outros', () => {
    const ns = [
      { id: 1, situation: 'official' as const },
      { id: 2, situation: 'never' as const },
      { id: 3, situation: 'disconnected' as const },
      { id: 4, situation: 'connected' as const },
      { id: 5, situation: 'disconnected' as const },
    ];
    expect(ordenarNumeros(ns).map((n) => n.id)).toEqual([3, 5, 1, 2, 4]);
  });
});
