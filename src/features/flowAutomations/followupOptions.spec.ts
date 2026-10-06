import { describe, it, expect } from 'vitest';
import { followupFlowOptions, followupPadraoId, legacySequenceNotice } from './followupOptions';
import { FLOW_KIND_COPY, flowPath, kindOf } from './kind';
import { businessHoursOnlyOf, waitUsesBusinessHours, withWaitBusinessHours } from './businessHours';
import { cleanProgressPrefix, withProgress } from './progress';
import { legacyQueueLine, legacyQueuesWithPending } from './legacyFollowup';

describe('follow-ups pra escolher (IA Vendedora e assistente)', () => {
  it('lista os não arquivados, marcando o desligado', () => {
    expect(followupFlowOptions([
      { id: 'a', name: 'Longo', is_enabled: true, archived_at: null },
      { id: 'b', name: 'Curto', is_enabled: false, archived_at: null },
      { id: 'c', name: 'Velho', is_enabled: true, archived_at: '2026-10-01' },
    ])).toEqual([{ value: 'a', label: 'Longo' }, { value: 'b', label: 'Curto (desligado)' }]);
  });

  it('avisa quando a IA ainda aponta só pro funil antigo', () => {
    expect(legacySequenceNotice({ followup_sequence_slug: 'follow-up-longo' })).toContain('"follow-up-longo"');
    expect(legacySequenceNotice({ followup_sequence_slug: 'x', followup_flow_id: 'f1' })).toBeNull();
    expect(legacySequenceNotice({})).toBeNull();
  });
});

describe('tipo do fluxo', () => {
  it('sem tipo é automação; follow-up mora em /automations/follow-ups', () => {
    expect(kindOf({})).toBe('automation');
    expect(kindOf({ kind: 'followup' })).toBe('followup');
    expect(kindOf({ state: { kind: 'followup' } })).toBe('followup');
    expect(flowPath({ id: 'x', kind: 'followup' })).toBe('/automations/follow-ups/x');
    expect(flowPath({ id: 'y' })).toBe('/automations/flow-builder/y');
    expect(FLOW_KIND_COPY.followup.newButton).toBe('Novo follow-up');
  });
});

describe('horário comercial', () => {
  it('lê a chave do fluxo solta ou em state', () => {
    expect(businessHoursOnlyOf({ business_hours_only: true })).toBe(true);
    expect(businessHoursOnlyOf({ state: { business_hours_only: true } })).toBe(true);
    expect(businessHoursOnlyOf({})).toBe(false);
  });

  it('no Esperar, o modo antigo vira tempo comum + business_hours', () => {
    expect(waitUsesBusinessHours({ mode: 'schedule' })).toBe(true);
    expect(withWaitBusinessHours({ mode: 'schedule', minutes: 60 }, true)).toEqual({ mode: 'interval', minutes: 60, business_hours: true });
  });
});

describe('marcar progresso', () => {
  it('limpa o nome da etiqueta', () => {
    expect(cleanProgressPrefix('Follow-up Ação 1')).toBe('follow-up-acao-1');
    expect(withProgress({ text: 'x' }, { on: true, prefix: 'fu', step: 0 })).toEqual({ text: 'x', progress_tag_prefix: 'fu', progress_step: 1 });
  });
});

describe('faixa do formato antigo', () => {
  it('só os funis com fila, do maior pro menor, com a frase da spec', () => {
    const filas = legacyQueuesWithPending([
      { id: '1', name: 'Apto', pending: 13 },
      { id: '2', name: 'Zerado', pending: 0 },
      { id: '3', name: 'Follow-up longo', pending: 87 },
    ]);
    expect(filas.map(f => f.id)).toEqual(['3', '1']);
    expect(legacyQueueLine(filas[0])).toBe('Follow-up longo — 87 mensagens programadas');
    expect(legacyQueueLine({ id: 'x', name: 'Um', pending: 1 })).toBe('Um — 1 mensagem programada');
  });
});

describe('followupPadraoId (06/10/2026)', () => {
  const f = (id: string, extra: Record<string, unknown> = {}) =>
    ({ id, name: `Fluxo ${id}`, is_enabled: true, archived_at: null, template_key: null, created_at: '2026-10-01T00:00:00Z', ...extra });

  it('prefere o do modelo follow_up_padrao: ligado e o mais antigo', () => {
    expect(followupPadraoId([
      f('outro'),
      f('novo', { template_key: 'follow_up_padrao', created_at: '2026-10-06T00:00:00Z' }),
      f('velho', { template_key: 'follow_up_padrao', created_at: '2026-10-02T00:00:00Z' }),
      f('desligado', { template_key: 'follow_up_padrao', is_enabled: false, created_at: '2026-09-01T00:00:00Z' }),
    ])).toBe('velho');
  });

  it('sem o modelo, o de nome exato; senão o primeiro ligado; arquivado nunca', () => {
    expect(followupPadraoId([f('a'), f('b', { name: 'Follow-up padrão' })])).toBe('b');
    expect(followupPadraoId([f('a', { is_enabled: false }), f('b'), f('c')])).toBe('b');
    expect(followupPadraoId([f('x', { template_key: 'follow_up_padrao', archived_at: '2026-10-05T00:00:00Z' }), f('y')])).toBe('y');
  });

  it('nenhum ligado nem padrão: vazio', () => {
    expect(followupPadraoId([f('a', { is_enabled: false })])).toBeNull();
    expect(followupPadraoId([])).toBeNull();
  });
});
