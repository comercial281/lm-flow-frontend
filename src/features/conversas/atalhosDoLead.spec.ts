import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EVENTO_IA_MUDOU,
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
