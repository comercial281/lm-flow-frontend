import { describe, expect, it } from 'vitest';
import type { AgentNumber, ResumoDoAgente, SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { quadroDoAgente } from './quadroDoAgente';

const numero = (id: string, dono: string, voz: AgentNumber['voice'] = { kind: 'corretor' }) =>
  ({ id, inbox_id: `in-${id}`, inbox_name: `Canal ${id}`, owner_name: dono, owner_user_id: `u-${id}`, voice: voz, enabled: true, connected: true } as unknown as AgentNumber);
const agente = (extra: Partial<SalesAgent> = {}) =>
  ({
    id: 'ag-1', name: 'Agente A', enabled: true, inbox_id: 'in-1', job: 'leva_visita', next_steps: ['visita'],
    house_voice: { kind: 'consultora' }, serves: ['empreendimento'], numbers: [],
    catalog_marks: { venda: 0, locacao: 0, leilao: 0, empreendimento: 10 }, triggers: [], trigger_keyword: null,
    trigger_match_mode: 'any', ...extra,
  }) as unknown as SalesAgent;
const NUMEROS = [numero('1', 'Ana'), numero('2', 'Bia'), numero('3', 'Caio')];
const resumo = (extra: Partial<ResumoDoAgente> = {}): ResumoDoAgente =>
  ({ id: 'ag-1', conversations: 74, handoffs: 46, median_reply_minutes: 4, numbers: [], ...extra });

describe('quadroDoAgente', () => {
  it('3 números, todos com voz Corretor: nomes e "Cada usuário, como ele mesmo"', () => {
    const q = quadroDoAgente(agente({ numbers: NUMEROS }), null);
    expect(q.numeros).toBe('3 números · Ana, Bia, Caio');
    expect(q.quemFala).toBe('Cada usuário, como ele mesmo');
  });

  it('sem número: "sem número"; um só: singular', () => {
    expect(quadroDoAgente(agente(), null).numeros).toBe('sem número');
    expect(quadroDoAgente(agente({ numbers: [NUMEROS[0]] }), null).numeros).toBe('1 número · Ana');
  });

  it('casa Consultora e números sem voz própria herdam a casa', () => {
    const sem = [numero('1', 'Ana', null), numero('2', 'Bia', null)];
    expect(quadroDoAgente(agente({ numbers: sem }), null).quemFala).toBe('Consultora');
    expect(quadroDoAgente(agente({ numbers: [] }), null).quemFala).toBe('Consultora');
    expect(quadroDoAgente(agente({ house_voice: { kind: 'dono_gerente' } }), null).quemFala).toBe('Dono ou gerente');
  });

  it('um número com voz diferente tira o "cada usuário"', () => {
    const misto = [numero('1', 'Ana'), numero('2', 'Bia', { kind: 'consultora' })];
    expect(quadroDoAgente(agente({ numbers: misto }), null).quemFala).toBe('Consultora');
  });

  it('modo operante', () => {
    expect(quadroDoAgente(agente({ job: 'filtra_passa' }), null).modo).toBe('Filtra e passa');
    expect(quadroDoAgente(agente({ job: 'leva_visita' }), null).modo).toBe('Leva até a visita');
  });

  it('próximo passo junta com "ou"', () => {
    expect(quadroDoAgente(agente({ next_steps: ['visita', 'videochamada'] }), null).proximoPasso).toBe('Visita ou Reunião por vídeo');
    expect(quadroDoAgente(agente({ next_steps: ['reuniao', 'ligacao'] }), null).proximoPasso).toBe('Reunião no escritório ou Ligação');
  });

  it('produto: marca com a contagem do cadastro', () => {
    expect(quadroDoAgente(agente(), null).produto).toBe('Empreendimento (10)');
    const duas = agente({ serves: ['venda', 'locacao'], catalog_marks: { venda: 3, locacao: 1, leilao: 0, empreendimento: 0 } });
    expect(quadroDoAgente(duas, null).produto).toBe('Venda (3), Locação (1)');
  });

  it('números de 30 dias, um por coluna', () => {
    expect(quadroDoAgente(agente(), resumo()).trintaDias).toEqual([
      { valor: '74', rotulo: 'conversas' }, { valor: '46', rotulo: 'passadas' }, { valor: '4 min', rotulo: 'corretor responde' },
    ]);
    expect(quadroDoAgente(agente(), resumo({ median_reply_minutes: null })).trintaDias).toEqual([
      { valor: '74', rotulo: 'conversas' }, { valor: '46', rotulo: 'passadas' },
    ]);
    expect(quadroDoAgente(agente(), resumo({ conversations: 1, handoffs: 1 })).trintaDias?.map((n) => n.rotulo))
      .toEqual(['conversa', 'passada', 'corretor responde']);
    expect(quadroDoAgente(agente(), null).trintaDias).toBeNull();
  });

  it('a contagem por marca pode vir de fora', () => {
    const q = quadroDoAgente(agente(), null, { venda: 0, locacao: 0, leilao: 0, empreendimento: 2 });
    expect(q.produto).toBe('Empreendimento (2)');
  });

  it('sem número nenhum, ligado ou não, o quadro pede "ligar um número"', () => {
    expect(quadroDoAgente(agente({ enabled: false, inbox_id: null }), null).pendencia).toBe('ligar um número');
    expect(quadroDoAgente(agente({ enabled: true, inbox_id: null }), null).pendencia).toBe('ligar um número');
  });

  it('com número e nada pendente, a pendência é nula', () => {
    expect(quadroDoAgente(agente({ numbers: NUMEROS }), null).pendencia).toBeNull();
  });
});
