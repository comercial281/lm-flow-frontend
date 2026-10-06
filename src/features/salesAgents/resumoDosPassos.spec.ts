import { describe, expect, it } from 'vitest';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { resumoDaJanela } from './followupHours';
import {
  fraseDoObjetivo, linhaDoTempo, proximosHorarios, resumoDeQuemAtende, resumoDoAtendimento, resumoDosPassos,
} from './resumoDosPassos';

describe('fraseDoObjetivo', () => {
  it('dono, vai até o fim, roleta escolhida, com resumo', () => {
    const a = agenteDeTeste({ persona_kind: 'owner', reach: 'visit', handoff_target: 'roleta', transfer_config: {} });
    expect(fraseDoObjetivo(a, { roleta: 'Fila Zona Sul' })).toBe('Ela qualifica, marca a visita e entrega pra roleta Fila Zona Sul com o resumo.');
  });

  it('assistente, só qualifica, roleta do número, sem resumo', () => {
    const a = agenteDeTeste({ persona_kind: 'assistant', reach: 'qualify', handoff_target: 'inbox_roleta', transfer_config: { briefing_enabled: false } });
    expect(fraseDoObjetivo(a)).toBe('Ela qualifica e entrega pra roleta do número.');
  });

  it('o próprio corretor avisa o dono do número', () => {
    const a = agenteDeTeste({ persona_kind: 'broker', reach: 'qualify', handoff_target: 'number_owner', number_owner_name: 'Dono Exemplo', transfer_config: {} });
    expect(fraseDoObjetivo(a)).toBe('Ela qualifica e avisa o dono do número (Dono Exemplo) com o resumo.');
  });
});

describe('resumoDoAtendimento', () => {
  it('todos os leads, 24h', () => {
    expect(resumoDoAtendimento(agenteDeTeste({ triggers: [], trigger_keyword: null, active_hours: { mode: 'always' } }), '(11) 91234-5678'))
      .toBe('Atende todos os leads do (11) 91234-5678, 24h.');
  });

  it('só fora do horário comercial, com aviso', () => {
    const a = agenteDeTeste({ triggers: [], active_hours: { mode: 'outside_business' }, out_of_hours_reply: true });
    expect(resumoDoAtendimento(a, 'Dono Exemplo')).toBe('Atende todos os leads do Dono Exemplo, só fora do horário comercial (18:00 às 07:00), e avisa quem escrever fora do horário.');
  });

  it('horário escolhido usa a mesma frase do follow-up; sem número, diz que não atende', () => {
    const janelas = [{ start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] }];
    const a = agenteDeTeste({ triggers: [{ type: 'keyword', value: 'call' }], active_hours: { mode: 'custom', windows: janelas } });
    expect(resumoDoAtendimento(a, 'Dono Exemplo')).toBe(`Atende só alguns leads do Dono Exemplo, ${resumoDaJanela(janelas)}.`);
    expect(resumoDoAtendimento(a, null)).toBe('Ainda sem número: ela não atende ninguém.');
  });
});

describe('resumoDeQuemAtende', () => {
  it('cada regra em português', () => {
    expect(resumoDeQuemAtende([
      { type: 'keyword', value: 'call', match_type: 'contains' },
      { type: 'keyword', value: 'oi', match_type: 'equals' },
      { type: 'origin', mode: 'ads' },
      { type: 'property', mode: 'code', code: 'AP01' },
      { type: 'tag', value: 'quente' },
      { type: 'form', form_ids: ['1', '2'] },
    ])).toEqual([
      'quem escrever "call"',
      'quem escrever exatamente "oi"',
      'quem veio de anúncio (Facebook, Instagram ou Google)',
      'quem veio do imóvel AP01',
      'quem tem a etiqueta "quente"',
      'quem veio de 2 formulários',
    ]);
  });
});

describe('linhaDoTempo', () => {
  it('retomada e entrega ao follow-up', () => {
    const a = agenteDeTeste({ followup_enabled: true, followup_only: false, reengagement_enabled: true, reengagement_first_hours: 1, reengagement_second_hours: 8, followup_min_days: 2, followup_max_days: 3, followup_action: 'sequence' });
    expect(linhaDoTempo(a)).toEqual(['1h sem resposta: 1ª retomada', '8h depois: 2ª retomada', 'Entrega o lead ao follow-up depois de 2 dias sem resposta']);
  });

  it('mover o card, sem retomada; follow-up desligado não tem linha', () => {
    const a = agenteDeTeste({ followup_enabled: true, reengagement_enabled: false, followup_min_days: 1, followup_max_days: 1, followup_action: 'pipeline' });
    expect(linhaDoTempo(a)).toEqual(['Move o card para a coluna escolhida depois de 1 dia sem resposta']);
    expect(linhaDoTempo(agenteDeTeste({ followup_enabled: false }))).toEqual([]);
  });

  // 06/10/2026: "A IA escreve" saiu. Nada de "a cada X dias, até N vezes".
  it('IA ainda na opção antiga: diz que falta escolher', () => {
    const a = agenteDeTeste({ followup_enabled: true, reengagement_enabled: false, followup_min_days: 3, followup_action: 'ai', followup_max_attempts: 0 });
    expect(linhaDoTempo(a)).toEqual(['Depois de 3 dias sem resposta: falta escolher o que ela faz']);
  });

  it('sem valor nenhum: também diz que falta escolher', () => {
    const a = agenteDeTeste({ followup_enabled: true, reengagement_enabled: false, followup_min_days: 2, followup_action: undefined as never });
    expect(linhaDoTempo(a)).toEqual(['Depois de 2 dias sem resposta: falta escolher o que ela faz']);
  });
});

describe('proximosHorarios', () => {
  // 05/10/2026 é segunda-feira. Datas montadas em hora local: o teste vale em qualquer fuso.
  const segunda10h = new Date(2026, 9, 5, 10, 0);

  it('um horário por dia, a partir da antecedência mínima', () => {
    expect(proximosHorarios({ days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', min_advance_hours: 24, max_advance_days: 30 }, segunda10h, 60))
      .toEqual(['ter 06/10 às 10:00', 'qua 07/10 às 09:00', 'qui 08/10 às 09:00']);
  });

  it('só sábados', () => {
    expect(proximosHorarios({ days: [6], start: '09:00', end: '12:00', min_advance_hours: 0, max_advance_days: 30 }, segunda10h, 60))
      .toEqual(['sáb 10/10 às 09:00', 'sáb 17/10 às 09:00', 'sáb 24/10 às 09:00']);
  });

  it('nada dentro da antecedência máxima', () => {
    expect(proximosHorarios({ days: [6], start: '09:00', end: '12:00', min_advance_hours: 0, max_advance_days: 1 }, segunda10h, 60)).toEqual([]);
  });
});

describe('resumoDosPassos', () => {
  it('uma linha por passo, de 1 a 7', () => {
    const a = agenteDeTeste({ persona_kind: 'owner', lead_facing_name: 'Carlos', reach: 'qualify', handoff_target: 'inbox_roleta', transfer_config: {}, greeting: null, followup_enabled: false });
    const linhas = resumoDosPassos(a as SalesAgent, { numero: 'Dono Exemplo' });
    expect(linhas.map((l) => l.passo)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(linhas[0].linha).toBe('Dono da imobiliária · Carlos');
    expect(linhas[2].linha).toBe('2 perguntas, 2 obrigatórias · primeira mensagem escrita pela IA');
    expect(linhas[3].linha).toBe('Não marca visita: só qualifica e passa');
    expect(linhas[6].linha).toBe('Não volta a chamar quem sumiu');
  });
});
