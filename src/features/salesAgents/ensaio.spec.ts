import { describe, it, expect } from 'vitest';
import {
  horaDoEnsaio, pausa, linhasDoQueAconteceria, itensDoTurno, respostasDoFormulario, textoDasRespostas,
  avisoDoModelo, nomeDoModelo, AVANCOS_DA_JANELA, painelDoEnsaio, linhaDoCard,
} from './ensaio';
import type { RehearsalOutcome, RehearsalTurn } from '@/services/salesAgents/salesAgentsService';

function outcome(extra: Partial<RehearsalOutcome> = {}): RehearsalOutcome {
  return {
    skipped: null, warnings: [], handoff: null, handoff_blocked: null, in_handoff: false, visit: null,
    collected: {}, checklist: [], temperature: null, stage: null, summary: null, labels: [], card: null,
    purpose: null, out_of_hours_notice: false, opening: null, model: null, test_model: null, agent_model: null,
    delay_s: null, notes: [],
    error: null, lead_owner: null, ...extra,
  };
}

function turno(extra: Partial<RehearsalTurn> = {}): RehearsalTurn {
  return { kind: 'reply', at: '2026-10-05T14:00:10-03:00', messages: [], reaction: null, note: null, media: [], outcome: outcome(), ...extra };
}

describe('ensaio', () => {
  // A hora vem do servidor no fuso da imobiliária; a tela não reconverte (o
  // navegador pode estar em outro fuso, e o teste roda em UTC).
  it('hora no formato brasileiro, lida do próprio texto', () => {
    expect(horaDoEnsaio('2026-10-05T14:02:00-03:00')).toBe('seg, 05/10 14:02');
  });

  it('pausa em segundos com vírgula; mensagem única não tem pausa', () => {
    expect(pausa(1200)).toBe('digitando 1,2 s');
    expect(pausa(0)).toBe('');
  });

  it('o que aconteceria: repasse, visita, trava informada e o que falta na ficha', () => {
    const linhas = linhasDoQueAconteceria(outcome({
      handoff: { kind: 'roleta', destination: 'Roleta Zona Sul', reason: 'pediu corretor' },
      visit: { date: '2026-10-08', time: '15:00', label: 'quinta, 08/10 às 15:00', realtor: 'Carla', property_code: null, notes: null },
      warnings: [{ reason: 'schedule_closed', text: 'Fora do horário de atendimento configurado' }],
      checklist: [{ pergunta: 'Renda?', resposta: null, obrigatoria: true }],
      collected: { regiao: 'Mooca', quartos: '' },
      temperature: 'hot',
      delay_s: 10,
    }));

    expect(linhas).toEqual([
      'Responderia uns 10 s depois da mensagem do lead',
      'No atendimento real: Fora do horário de atendimento configurado. O teste respondeu mesmo assim.',
      'Passaria pra Roleta Zona Sul agora',
      'Motivo pro corretor: pediu corretor',
      'Marcaria visita quinta, 08/10 às 15:00 com Carla',
      'Falta 1 pergunta obrigatória antes de passar',
      'Ficha: Região: Mooca',
      'Temperatura: Quente',
    ]);
  });

  it('sem destino e lead com dono têm frase própria', () => {
    expect(linhasDoQueAconteceria(outcome({ handoff: { kind: 'none', destination: null, problem: 'o número não tem roleta' } })))
      .toContain('Tentaria passar o lead, mas não tem pra quem: o número não tem roleta');
    expect(linhasDoQueAconteceria(outcome({ handoff: { kind: 'owner', destination: 'Bruno' } })))
      .toContain('Devolveria o lead pro dono dele: Bruno');
  });

  it('turno calado vira uma linha de sistema com o motivo', () => {
    const itens = itensDoTurno(turno({
      kind: 'silent',
      outcome: outcome({ skipped: { reason: 'handoff_done', text: 'O lead foi transferido' } }),
    }), '');
    expect(itens).toEqual([{ tipo: 'sistema', texto: 'Ela ficaria calada: O lead foi transferido' }]);
  });

  it('rajada vira uma bolha por mensagem, e a mídia leva o imóvel do turno', () => {
    const itens = itensDoTurno(turno({
      messages: [{ content: 'Oi!', pause_ms: 0 }, { content: 'Pra morar?', pause_ms: 1200 }],
      reaction: '👍',
      media: [{ type: 'photos', token: 'tok', urls: ['u'] }],
    }), 'AP1');

    expect(itens).toEqual([
      { tipo: 'sistema', texto: 'Curtiria a mensagem do lead com 👍' },
      { tipo: 'ia', texto: 'Oi!', pausa: 0 },
      { tipo: 'ia', texto: 'Pra morar?', pausa: 1200 },
      { tipo: 'midia', item: { type: 'photos', token: 'tok', urls: ['u'] }, propertyCode: 'AP1' },
    ]);
  });

  it('avanço: o tempo passando e a retomada como bolha', () => {
    const itens = itensDoTurno(turno({
      kind: 'advance', outcome: null, at: '2026-10-05T16:02:00-03:00',
      events: [{ kind: 'reengagement', at: '2026-10-05T16:00:20-03:00', attempt: 1, messages: [{ content: 'E aí?', pause_ms: 0 }], blank: false }],
      idle: null, notes: [],
    }), '');

    expect(itens).toEqual([
      { tipo: 'sistema', texto: '⏩ seg, 05/10 16:00 · Retomada 1 de 2' },
      { tipo: 'ia', texto: 'E aí?', pausa: 0 },
    ]);
  });

  // Decisão do dono do produto (05/10): o Testar roda no Haiku, e a tela diz isso.
  it('selo do modelo do teste e aviso quando a IA atende em outro modelo', () => {
    expect(nomeDoModelo('claude-haiku-4-5')).toBe('Haiku');
    expect(nomeDoModelo('claude-sonnet-4-5')).toBe('Sonnet');
    expect(avisoDoModelo('claude-haiku-4-5', 'claude-sonnet-4-5')).toEqual({
      selo: 'Teste no Haiku', nota: 'Esta IA atende no Sonnet; o teste usa o Haiku',
    });
    expect(avisoDoModelo('claude-haiku-4-5', 'claude-haiku-4-5-20251001')).toEqual({ selo: 'Teste no Haiku', nota: null });
    expect(avisoDoModelo('claude-haiku-4-5', null)).toEqual({ selo: 'Teste no Haiku', nota: null });
  });

  it('respostas do formulário: uma por linha, "pergunta: resposta", e de volta', () => {
    const r = respostasDoFormulario('Renda: 8 mil\n\nPra quando?: 3 meses\nlixo');
    expect(r).toEqual({ Renda: '8 mil', 'Pra quando?': '3 meses' });
    expect(textoDasRespostas(r)).toBe('Renda: 8 mil\nPra quando?: 3 meses');
  });
});

describe('aviso de IA sem número', () => {
  it('não repete "no atendimento real" (o texto do servidor já diz)', () => {
    const texto = 'A IA está sem número: no atendimento real nenhuma mensagem sairia';
    const linhas = linhasDoQueAconteceria(outcome({ warnings: [{ reason: 'no_number', text: texto }] }));
    const linha = linhas.find((l) => l.includes('sem número')) ?? '';
    expect(linha).toBe(`${texto}. O teste respondeu mesmo assim.`);
    expect(linha.match(/no atendimento real/gi)).toHaveLength(1);
  });
});

describe('ajustes da revisão final', () => {
  it('resposta do formulário com hora não se parte no dois-pontos errado', () => {
    expect(respostasDoFormulario('Melhor horário: 14:30')).toEqual({ 'Melhor horário': '14:30' });
  });

  it('repasse pro sistema do cliente tem frase própria', () => {
    expect(linhasDoQueAconteceria(outcome({ handoff: { kind: 'webhook', destination: null } }))).toContain('Mandaria o lead pro sistema do cliente agora');
  });
});


describe('painelDoEnsaio (Testar novo)', () => {
  it('caminho do estado, temperatura com nível e as perguntas com o que falta', () => {
    const p = painelDoEnsaio(
      { caminho: 'Sair do aluguel' } as never,
      { temperature: 'warm', checklist: [{ pergunta: 'Renda', resposta: 'até 6 mil', obrigatoria: true }, { pergunta: 'Quartos', resposta: ' ', obrigatoria: false }] } as never,
    );
    expect(p.caminho).toBe('Sair do aluguel');
    expect(p.temperatura).toEqual({ rotulo: 'Morna', nivel: 2 });
    expect(p.perguntas).toEqual([
      { texto: 'Renda', resposta: 'até 6 mil', obrigatoria: true },
      { texto: 'Quartos', resposta: null, obrigatoria: false },
    ]);
  });

  it('sem nada ainda: tudo vazio', () => {
    expect(painelDoEnsaio(null, null)).toEqual({ caminho: null, temperatura: null, perguntas: [] });
  });

  // Onda 2 ainda não no ar: o estado vem sem `caminho` e o painel diz "ainda não escolheu".
  it('estado sem o campo caminho (servidor antigo): caminho nulo', () => {
    expect(painelDoEnsaio({ v: 1 } as never, null).caminho).toBeNull();
  });

  it('avanços da janela: até ela agir, 1 h, +8 h, 1 dia, 3 dias', () => {
    expect(AVANCOS_DA_JANELA.map((a) => [a.rotulo, a.horas])).toEqual([
      ['Até ela agir sozinha', null], ['1 h', 1], ['+8 h', 8], ['1 dia', 24], ['3 dias', 72],
    ]);
  });
});

describe('linhaDoCard', () => {
  it('com "Mover o card" ligado diz a coluna do momento, em português', () => {
    expect(linhaDoCard(outcome({ card: { stage: 'qualificando', moves: true } }))).toBe('Card: vai pra coluna de "Qualificando"');
  });
  it('desligado: o card fica onde está', () => {
    expect(linhaDoCard(outcome({ card: { stage: 'agendado', moves: false } }))).toBe('Card: fica onde está (Mover o card no funil está desligado)');
  });
  it('sem card ou sem momento: nada', () => {
    expect(linhaDoCard(outcome())).toBeNull();
    expect(linhaDoCard(outcome({ card: { stage: null, moves: true } }))).toBeNull();
    expect(linhaDoCard(null)).toBeNull();
  });
  it('momento desconhecido sai como veio', () => {
    expect(linhaDoCard(outcome({ card: { stage: 'novo_momento', moves: true } }))).toBe('Card: vai pra coluna de "novo_momento"');
  });
});
