import { describe, it, expect } from 'vitest';
import { toRelativeSteps, toCumulativeSteps, pickUnit, cumulativeUpTo } from './delayConversion';
import type { FollowupStep } from '@/services/followupSequences/followupSequencesService';

/**
 * A tela edita "esperar X depois da mensagem anterior"; a API guarda o tempo
 * cumulativo desde o início do funil. A conversão entre os dois é o ponto onde um
 * erro estraga silenciosamente o funil de um cliente — daí estes exemplos.
 */

const steps = (...minutes: number[]): FollowupStep[] =>
  minutes.map((m, i) => ({
    position: i + 1,
    delay_minutes: m,
    message_type: 'text' as const,
    content: `msg ${i + 1}`,
  }));

const delays = (list: FollowupStep[]) => list.map(s => s.delay_minutes);

describe('tempo do passo: cumulativo ↔ relativo', () => {
  it('lê um funil salvo como distâncias entre as mensagens', () => {
    // 0, 1 dia, 2 dias  ->  na hora, 1 dia depois, 1 dia depois
    expect(delays(toRelativeSteps(steps(0, 1440, 2880)))).toEqual([0, 1440, 1440]);
  });

  it('grava as distâncias de volta como tempo desde o início', () => {
    expect(delays(toCumulativeSteps(steps(0, 1440, 1440)))).toEqual([0, 1440, 2880]);
  });

  // O teste que protege funil de cliente: abrir o editor e salvar sem mexer em
  // nada não pode alterar nenhum tempo.
  it('ida e volta não muda nada', () => {
    const saved = steps(0, 1440, 2880, 5760, 10080);

    expect(delays(toCumulativeSteps(toRelativeSteps(saved)))).toEqual(delays(saved));
  });

  it('aguenta funil que não começa em zero', () => {
    // Funil antigo, antes da conversão do backend: 30 / 1 dia e meia hora.
    expect(delays(toRelativeSteps(steps(30, 1470)))).toEqual([30, 1440]);
  });

  // Passo fora de ordem geraria distância negativa, que viraria tempo negativo no
  // banco. Vira zero — "manda junto com a anterior".
  it('não produz tempo negativo quando os passos estão fora de ordem', () => {
    expect(delays(toRelativeSteps(steps(100, 50)))).toEqual([100, 0]);
  });
});

describe('unidade mostrada na tela', () => {
  it('mostra dias quando o número é redondo em dias', () => {
    expect(pickUnit(10080)).toBe('d');
    expect(pickUnit(1440)).toBe('d');
  });

  it('mostra horas quando é redondo em horas', () => {
    expect(pickUnit(120)).toBe('h');
  });

  it('cai pra minutos no resto — e no zero', () => {
    expect(pickUnit(90)).toBe('min');
    expect(pickUnit(0)).toBe('min');
  });
});

describe('resumo de quanto tempo desde o início', () => {
  it('soma as distâncias até o passo', () => {
    const relatives = steps(0, 1440, 1440);

    expect(cumulativeUpTo(relatives, 0)).toBe(0);
    expect(cumulativeUpTo(relatives, 2)).toBe(2880);
  });
});
