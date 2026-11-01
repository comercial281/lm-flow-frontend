import { describe, expect, it } from 'vitest';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { lerEscolhas } from './tresEscolhas';

const ia = (extra: Partial<SalesAgent> = {}) =>
  ({ transfer_config: {}, booking_enabled: true, handoff_target: 'inbox_roleta', handoff_roleta_config_id: null, handoff_user_id: null, ...extra }) as SalesAgent;

describe('lerEscolhas', () => {
  it('lê as colunas novas quando vêm do servidor', () => {
    expect(lerEscolhas(ia({ persona_kind: 'owner', reach: 'qualify', handoff_target: 'roleta' }))).toEqual({
      persona: 'owner', alcance: 'qualify', destino: 'roleta',
    });
  });

  // Servidor antigo (sem as colunas): a mesma derivação do SalesAgent#persona_kind_value.
  it('sem coluna, deriva da voz e do agendar visita', () => {
    expect(lerEscolhas(ia({ transfer_config: { voice: 'first_person' } }))).toMatchObject({ persona: 'broker', alcance: 'visit' });
    expect(lerEscolhas(ia({ booking_enabled: false }))).toMatchObject({ persona: 'assistant', alcance: 'qualify' });
  });
});
