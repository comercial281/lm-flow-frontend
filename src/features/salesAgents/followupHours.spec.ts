import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FOLLOWUP_WINDOW, estimativaPorDia, janelaDoFollowup, minutosPorDia, resumoDaJanela,
} from './followupHours';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';

/**
 * O horário próprio do follow-up.
 *
 * Este arquivo existe porque a janela estava escrita TRÊS vezes na tela — o texto
 * "das 9h às 20h", a descrição da chave de horário e um `11 * 60` no cálculo.
 * Bastava mudar uma para o gestor ler um horário e receber a conta de outro.
 */
const agente = (extra: Partial<SalesAgent> = {}) => ({
  followup_drip_min_leads: 2,
  followup_drip_max_leads: 3,
  followup_drip_min_minutes: 3,
  followup_drip_max_minutes: 5,
  ...extra,
} as SalesAgent);

describe('janelaDoFollowup', () => {
  it('cai no padrão de fábrica quando o servidor ainda não mandou nada', () => {
    expect(janelaDoFollowup(agente())).toEqual([DEFAULT_FOLLOWUP_WINDOW]);
  });

  it('cai no padrão com lista de janelas vazia', () => {
    const a = agente({ followup_hours: { mode: 'custom', windows: [] } });
    expect(janelaDoFollowup(a)).toEqual([DEFAULT_FOLLOWUP_WINDOW]);
  });

  it('devolve o que está gravado', () => {
    const janelas = [{ start: '10:00', end: '12:00', days: [1] }];
    const a = agente({ followup_hours: { mode: 'custom', windows: janelas } });
    expect(janelaDoFollowup(a)).toEqual(janelas);
  });
});

describe('minutosPorDia', () => {
  it('conta a janela cheia do padrão (09h às 17h = 480 min)', () => {
    expect(minutosPorDia([DEFAULT_FOLLOWUP_WINDOW])).toBe(480);
  });

  // ⚠️ É o dia MAIS CHEIO, não a média semanal: quem lê "leads por dia" com uma
  // janela de seg a sex quer o dia útil, não a média diluída pelo fim de semana.
  it('usa o dia mais cheio, não a média da semana', () => {
    const janelas = [
      { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] },
      { start: '09:00', end: '11:00', days: [6] },
    ];
    expect(minutosPorDia(janelas)).toBe(480);
  });

  it('soma as janelas do mesmo dia (manhã + tarde)', () => {
    const janelas = [
      { start: '08:00', end: '12:00', days: [1] },
      { start: '14:00', end: '18:00', days: [1] },
    ];
    expect(minutosPorDia(janelas)).toBe(480);
  });

  it('entende janela que vira a meia-noite', () => {
    expect(minutosPorDia([{ start: '22:00', end: '06:00' }])).toBe(480);
  });

  // ⚠️ O intervalo é [início, fim): igual não é 24h, é NADA — e é assim que o
  // servidor trata. Quem quiser o dia inteiro escreve 00:00 às 23:59.
  it('trata início igual ao fim como duração zero', () => {
    expect(minutosPorDia([{ start: '00:00', end: '00:00' }])).toBe(0);
    expect(minutosPorDia([{ start: '00:00', end: '23:59' }])).toBe(1439);
  });

  it('ignora horário malformado em vez de estourar', () => {
    expect(minutosPorDia([{ start: 'lixo', end: '17:00' }])).toBe(0);
  });
});

describe('resumoDaJanela', () => {
  it('descreve o padrão de fábrica', () => {
    expect(resumoDaJanela([DEFAULT_FOLLOWUP_WINDOW])).toBe('das 09h às 17h, seg a sáb');
  });

  it('descreve a semana inteira como "todos os dias"', () => {
    expect(resumoDaJanela([{ start: '09:00', end: '17:00' }])).toBe('das 09h às 17h, todos os dias');
  });

  it('descreve dias soltos', () => {
    expect(resumoDaJanela([{ start: '09:00', end: '17:00', days: [1, 3, 5] }]))
      .toBe('das 09h às 17h, seg, qua e sex');
  });

  it('avisa quando há mais de uma janela', () => {
    const janelas = [
      { start: '08:00', end: '12:00', days: [1, 2, 3, 4, 5] },
      { start: '14:00', end: '18:00', days: [1, 2, 3, 4, 5] },
    ];
    expect(resumoDaJanela(janelas)).toBe('das 08h às 12h, seg a sex (+1 janela)');
  });
});

describe('estimativaPorDia', () => {
  // A conta de padeiro não é enfeite: sem ela o gestor escolhe "2 a 3 leads a
  // cada 3 minutos" achando que é pouco.
  it('usa a janela configurada, não um número fixo', () => {
    // Padrão: 480 min ÷ 4 min de pausa × 2,5 leads = 300.
    expect(estimativaPorDia(agente())).toBe(300);

    const curta = agente({ followup_hours: { mode: 'custom', windows: [{ start: '09:00', end: '11:00' }] } });
    // 120 min ÷ 4 × 2,5 = 75.
    expect(estimativaPorDia(curta)).toBe(75);
  });

  it('é zero quando a janela não tem duração', () => {
    const zerada = agente({ followup_hours: { mode: 'custom', windows: [{ start: '09:00', end: '09:00' }] } });
    expect(estimativaPorDia(zerada)).toBe(0);
  });
});
