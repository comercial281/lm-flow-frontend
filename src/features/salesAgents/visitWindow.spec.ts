import { describe, expect, it } from 'vitest';

import { fonteDaIaVendedora } from '../../test/fonteDaIaVendedora';
import { PAGINAS } from '@/pages/Customer/Automations/SalesAgents/configurar/paginas';

import { antecedenciaResumo } from './visitWindow';

// O guardrail de visita (21/09/2026): a IA vinha prometendo horário que o
// servidor recusava depois, e chegou a dizer a um lead que já estava no imóvel
// que havia alguém lá para recebê-lo.
//
// A mecânica mora no servidor. Aqui ficam a leitura da antecedência e as duas
// cicatrizes desta tela, que são CALADAS — nenhuma quebra tipo, render ou build.

describe('a leitura da antecedência mínima', () => {
  it('traduz 24 horas para "amanhã", que é o que o número significa', () => {
    expect(antecedenciaResumo(24)).toContain('amanhã');
  });

  it('conta em dias quando o valor é múltiplo de um dia', () => {
    expect(antecedenciaResumo(48)).toContain('2 dias');
  });

  it('mantém as horas quando não fecha um dia', () => {
    expect(antecedenciaResumo(4)).toContain('4 horas');
    expect(antecedenciaResumo(1)).toContain('1 hora');
  });

  it('diz que zero libera o próprio dia', () => {
    expect(antecedenciaResumo(0)).toContain('hoje');
  });

  it('não quebra com valor sem sentido vindo do campo', () => {
    expect(antecedenciaResumo(Number.NaN)).toContain('amanhã');
    expect(antecedenciaResumo(-5)).toContain('hoje');
  });
});

describe('a chave da visita no mesmo dia', () => {
  const tela = fonteDaIaVendedora();

  // Ausente = LIGADA. Lida com `=== true`, todo agente que já existe apareceria
  // DESLIGADO na tela — e o gestor "ligaria" algo que já estava valendo. Mesma
  // cicatriz do gotejamento do follow-up.
  it('é lida com !== false, nunca com === true', () => {
    expect(tela).toContain('c.same_day_requires_human !== false');
    expect(tela).not.toContain('c.same_day_requires_human === true');
  });

  // Desde a onda 3 cada página grava os campos DELA (paginas.ts): a chave é
  // subchave do visit_config na página Agendamento, mesclada sobre o último salvo.
  it('é campo da página Agendamento, por dentro do visit_config', () => {
    expect(PAGINAS.agendamento.campos).toContain('visit_config.same_day_requires_human');
  });

  // A tela precisa dizer o que a chave faz: quem liga e manda uma mensagem de
  // teste pedindo visita para hoje vê a IA recusar e acha que quebrou.
  it('explica na tela que a IA nunca afirma presença de ninguém no local', () => {
    expect(tela).toContain('Visita para hoje só com o corretor confirmando');
    expect(tela).toContain('quem confirma presença é o corretor');
  });
});
