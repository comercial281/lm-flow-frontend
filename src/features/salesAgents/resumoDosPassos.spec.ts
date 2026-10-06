import { describe, expect, it } from 'vitest';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { fraseDoObjetivo } from './resumoDosPassos';

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
