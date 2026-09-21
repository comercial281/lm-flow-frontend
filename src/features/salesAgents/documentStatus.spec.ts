import { describe, it, expect } from 'vitest';
import {
  processingLabel,
  processingWarning,
  SLOW_AFTER_MS,
  GIVE_UP_MINUTES,
} from './documentStatus';

const agora = new Date('2026-09-21T12:00:00Z');
const atras = (min: number) => new Date(agora.getTime() - min * 60000).toISOString();

describe('processingLabel', () => {
  it('no primeiro minuto é só "Processando..."', () => {
    expect(processingLabel(atras(0), agora)).toBe('Processando...');
  });

  // O ponto da leva: o texto fixo era idêntico depois de dois segundos e depois de
  // dois dias, e quem esperava não tinha como saber se ainda estava andando.
  it('depois diz há quanto tempo', () => {
    expect(processingLabel(atras(6), agora)).toBe('Processando há 6 min');
  });

  it('sem data, não inventa tempo', () => {
    expect(processingLabel(undefined, agora)).toBe('Processando...');
    expect(processingLabel('não é data', agora)).toBe('Processando...');
  });

  // Relógio do aparelho adiantado não pode produzir "há -3 min".
  it('nunca conta tempo negativo', () => {
    expect(processingLabel(atras(-5), agora)).toBe('Processando...');
  });
});

describe('processingWarning', () => {
  it('não avisa enquanto a espera é normal', () => {
    expect(processingWarning(atras(1), agora)).toBeNull();
  });

  it('avisa quando passa do tempo normal e diz quando isso acaba', () => {
    const aviso = processingWarning(atras(SLOW_AFTER_MS / 60000 + 1), agora);
    expect(aviso).toContain('demorando mais que o normal');
    expect(aviso).toContain(String(GIVE_UP_MINUTES));
  });

  it('sem data não avisa nada', () => {
    expect(processingWarning(null, agora)).toBeNull();
  });
});
