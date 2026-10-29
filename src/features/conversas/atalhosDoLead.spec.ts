import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EVENTO_IA_MUDOU,
  EVENTO_IA_RECARREGAR,
  avisarSeEventoDaIa,
  avisarIaMudou,
  dicaDaIa,
  iaLigada,
  iaNoNumero,
  leadDoPainelParaVisita,
  nomeDaAcaoIa,
} from './atalhosDoLead';
import type { SalesAgentCardState } from '@/types/analytics/pipelines';

const estado = (status: SalesAgentCardState['status'], label = 'IA ligada'): SalesAgentCardState => ({
  status,
  label,
  agent_id: status === 'none' ? null : 'ia-1',
});

describe('IA nos atalhos do lead', () => {
  it('só existe quando o número tem IA', () => {
    expect(iaNoNumero(null)).toBe(false);
    expect(iaNoNumero(estado('none'))).toBe(false);
    for (const s of ['active', 'idle', 'paused', 'handoff'] as const) expect(iaNoNumero(estado(s))).toBe(true);
  });

  it('ligada = atendendo ou esperando o gatilho (a mesma régua do topo da conversa)', () => {
    expect(iaLigada(estado('active'))).toBe(true);
    expect(iaLigada(estado('idle'))).toBe(true);
    expect(iaLigada(estado('paused'))).toBe(false);
    expect(iaLigada(estado('handoff'))).toBe(false);
    expect(iaLigada(null)).toBe(false);
  });

  it('nome do botão e dica dizem o que o clique faz', () => {
    expect(nomeDaAcaoIa(estado('active'))).toBe('Desligar IA Vendedora');
    expect(nomeDaAcaoIa(estado('paused'))).toBe('Ligar IA Vendedora');
    expect(nomeDaAcaoIa(estado('handoff'))).toBe('Religar IA Vendedora');

    expect(dicaDaIa(estado('active', 'IA atendendo'))).toBe('IA atendendo — clique para desativar');
    expect(dicaDaIa(estado('paused', 'IA desligada neste lead'))).toBe('IA desligada neste lead — clique para reativar');
    expect(dicaDaIa(estado('handoff'))).toBe('A IA passou este lead pra um corretor — clique para religar');
  });
});

describe('avisarIaMudou', () => {
  afterEach(() => vi.restoreAllMocks());

  it('avisa a tela inteira com a conversa e o estado novo', () => {
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_IA_MUDOU, ouvinte);
    avisarIaMudou(42, estado('paused'));
    window.removeEventListener(EVENTO_IA_MUDOU, ouvinte);

    const detalhe = (ouvinte.mock.calls[0][0] as CustomEvent).detail;
    expect(detalhe).toEqual({ conversationId: '42', state: estado('paused') });
  });
});

describe('leadDoPainelParaVisita', () => {
  const contato = { id: 7, name: 'Lead Fictício', phone_number: '+5511900000000', email: null };

  it('fora de funil: o contato, sem funil e sem dono', () => {
    expect(leadDoPainelParaVisita(contato, [], 'Lead Fictício')).toEqual({
      id: '7',
      name: 'Lead Fictício',
      phone_number: '+5511900000000',
      email: null,
      in_pipeline: false,
      pipeline_id: null,
      owner: null,
    });
  });

  it('no funil: leva o funil e o responsável do card (a janela já abre com o corretor)', () => {
    const funis = [
      {
        id: 'funil-1',
        stages: [
          { id: 'e0', items: [] },
          { id: 'e1', items: [{ id: 'item-1', pipeline_id: 'funil-1', assignee: { id: 3, name: 'Marina' } }] },
        ],
      },
    ];
    expect(leadDoPainelParaVisita(contato, funis as never, 'Lead Fictício')).toMatchObject({
      in_pipeline: true,
      pipeline_id: 'funil-1',
      owner: { id: '3', name: 'Marina' },
    });
  });

  it('sem contato, não tem visita', () => {
    expect(leadDoPainelParaVisita(null, [], 'x')).toBeNull();
    expect(leadDoPainelParaVisita({ id: undefined } as never, [], 'x')).toBeNull();
  });
});

describe('IA desligada porque alguém respondeu à mão', () => {
  const agora = new Date(2026, 9, 28, 15, 0);
  const pausada = (by: string | null, at: string): SalesAgentCardState => ({
    ...estado('paused', 'IA desligada neste lead'),
    paused_by: { reason: 'manual_message', by, at },
  });

  it('mesmo dia: diz quem e a hora', () => {
    expect(dicaDaIa(pausada('Bruno Teste', new Date(2026, 9, 28, 10, 16).toISOString()), agora)).toBe(
      'IA desligada: Bruno Teste respondeu à mão às 10h16. Clique para religar',
    );
  });

  it('outro dia: diz a data', () => {
    expect(dicaDaIa(pausada('Bruno Teste', new Date(2026, 9, 27, 10, 16).toISOString()), agora)).toBe(
      'IA desligada: Bruno Teste respondeu à mão em 27/10 às 10h16. Clique para religar',
    );
  });

  it('sem nome: alguém da equipe', () => {
    expect(dicaDaIa(pausada(null, new Date(2026, 9, 28, 10, 16).toISOString()), agora)).toBe(
      'IA desligada: alguém da equipe respondeu à mão às 10h16. Clique para religar',
    );
  });

  it('hora cheia sem minutos', () => {
    expect(dicaDaIa(pausada('Bruno Teste', new Date(2026, 9, 28, 10, 0).toISOString()), agora)).toBe(
      'IA desligada: Bruno Teste respondeu à mão às 10h. Clique para religar',
    );
    expect(dicaDaIa(pausada('Bruno Teste', new Date(2026, 9, 27, 9, 0).toISOString()), agora)).toBe(
      'IA desligada: Bruno Teste respondeu à mão em 27/10 às 9h. Clique para religar',
    );
  });

  it('sem horário (at nulo): texto de sempre, nunca 1970', () => {
    expect(dicaDaIa(pausada('Bruno Teste', null as never), agora)).toBe('IA desligada neste lead \u2014 clique para reativar');
    expect(dicaDaIa(pausada('Bruno Teste', ''), agora)).toBe('IA desligada neste lead \u2014 clique para reativar');
  });

  it('data inválida ou sem paused_by: texto de sempre', () => {
    expect(dicaDaIa(pausada('Bruno Teste', 'lixo'), agora)).toBe('IA desligada neste lead \u2014 clique para reativar');
    expect(dicaDaIa(estado('paused', 'IA desligada neste lead'), agora)).toBe('IA desligada neste lead \u2014 clique para reativar');
  });
});

describe('avisarSeEventoDaIa', () => {
  const msg = (type?: string) =>
    ({ id: 1, conversation_id: 77, content_attributes: type ? { event: { type } } : {} }) as never;

  it('dispara só pros dois eventos da IA', () => {
    const ouvir = vi.fn();
    window.addEventListener(EVENTO_IA_RECARREGAR, ouvir);
    avisarSeEventoDaIa(msg('ai_paused_manual'));
    avisarSeEventoDaIa(msg('ai_resumed'));
    avisarSeEventoDaIa(msg('visit_scheduled'));
    avisarSeEventoDaIa(msg());
    window.removeEventListener(EVENTO_IA_RECARREGAR, ouvir);
    expect(ouvir).toHaveBeenCalledTimes(2);
    expect((ouvir.mock.calls[0][0] as CustomEvent).detail).toEqual({ conversationId: '77' });
  });
});
