import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  corDaSituacao,
  ehAtrasada,
  estiloDaSituacao,
  SITUACOES_DA_LEGENDA,
} from './situacaoDaVisita';

describe('situacaoDaVisita', () => {
  it('toda situação tem cor própria', () => {
    const cores = SITUACOES_DA_LEGENDA.map(s => corDaSituacao(s.status));
    expect(SITUACOES_DA_LEGENDA).toHaveLength(7);
    expect(new Set(cores).size).toBe(7);
    expect(estiloDaSituacao('confirmed')).toEqual({ '--st': 'var(--visita-confirmed)' });
  });

  it('nenhuma situação usa a cor da marca (nem roxo)', () => {
    for (const s of SITUACOES_DA_LEGENDA) {
      expect(corDaSituacao(s.status)).not.toContain('primary');
    }
    const css = readFileSync(resolve(__dirname, '../../styles/globals.css'), 'utf8');
    const tokens = [...css.matchAll(/--visita-[a-z_]+:\s*oklch\(([^)]+)\)/g)];
    expect(tokens.length).toBe(16);
    for (const [, v] of tokens) {
      const hue = Number(v.trim().split(/\s+/)[2]);
      expect(hue < 280 || hue > 310).toBe(true);
    }
  });

  it('situação desconhecida cai na Agendada', () => {
    expect(corDaSituacao('xyz')).toBe('var(--visita-scheduled)');
  });

  it('ehAtrasada', () => {
    const agora = new Date('2026-10-27T12:00:00-03:00');
    expect(ehAtrasada({ status: 'scheduled', scheduled_at: '2026-10-26T10:00:00-03:00' }, agora)).toBe(true);
    expect(ehAtrasada({ status: 'confirmed', scheduled_at: '2026-10-26T10:00:00-03:00' }, agora)).toBe(true);
    expect(ehAtrasada({ status: 'completed', scheduled_at: '2026-10-26T10:00:00-03:00' }, agora)).toBe(false);
    expect(ehAtrasada({ status: 'scheduled', scheduled_at: '2026-10-28T10:00:00-03:00' }, agora)).toBe(false);
  });
});
