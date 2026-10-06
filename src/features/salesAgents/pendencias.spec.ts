import { describe, expect, it } from 'vitest';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { FRASE_SEM_DONO, passoComPendencia, pendenciasDosPassos, podeLigar } from './pendencias';

const ia = (extra: Partial<SalesAgent> = {}) =>
  ({
    persona_kind: 'owner', reach: 'qualify', transfer_config: { mode: 'checklist' }, handoff_target: 'inbox_roleta',
    handoff_roleta_config_id: null, handoff_user_id: null, lead_facing_name: 'Bia', inbox_id: 'inbox-1',
    number_owner_id: 'u7', qualification_questions: ['Renda'], trigger_keyword: null,
    followup_enabled: true, followup_max_attempts: 3, ...extra,
  }) as SalesAgent;

describe('pendenciasDosPassos', () => {
  it('IA completa: nenhuma, e o Ligar está livre', () => {
    expect(pendenciasDosPassos(ia())).toEqual([]);
    expect(passoComPendencia(ia())).toBeNull();
    expect(podeLigar(ia())).toEqual({ pode: true, motivo: null });
  });

  it('sem número: passo 6 e trava o Ligar', () => {
    const a = ia({ inbox_id: null });
    expect(passoComPendencia(a)).toBe(6);
    expect(podeLigar(a)).toEqual({ pode: false, motivo: 'Falta o número de WhatsApp.' });
  });

  it('corretor sem dono trava o Ligar, no passo 1', () => {
    const a = ia({ persona_kind: 'broker', handoff_target: 'number_owner', number_owner_id: null });
    expect(pendenciasDosPassos(a)[0]).toMatchObject({ passo: 1, frase: FRASE_SEM_DONO, impedeLigar: true });
    expect(podeLigar(a).pode).toBe(false);
  });

  // Pinot & Cheer: fala como o corretor e entrega pra um fixo. Revisar, sem travar.
  it('corretor com destino que não é o dono do número: aviso no passo 2, sem travar', () => {
    const a = ia({ persona_kind: 'broker', handoff_target: 'user', handoff_user_id: 'u9' });
    expect(pendenciasDosPassos(a)).toEqual([expect.objectContaining({ chave: 'persona_destino', passo: 2, impedeLigar: false })]);
    expect(podeLigar(a).pode).toBe(true);
  });

  it('sem o nome que o lead vê: passo 1, e trava o Ligar', () => {
    const a = ia({ lead_facing_name: '  ' });
    expect(pendenciasDosPassos(a)[0]).toMatchObject({ passo: 1, chave: 'nome_visivel', impedeLigar: true });
    expect(podeLigar(a)).toEqual({ pode: false, motivo: 'Falta o nome que o lead vê.' });
  });

  it('roleta ou corretor sem escolha, perguntas vazias, palavra antiga e follow-up sem limite', () => {
    expect(passoComPendencia(ia({ handoff_target: 'roleta' }))).toBe(2);
    expect(passoComPendencia(ia({ handoff_target: 'user' }))).toBe(2);
    expect(passoComPendencia(ia({ qualification_questions: [' '] }))).toBe(3);
    expect(pendenciasDosPassos(ia({ trigger_keyword: 'call' }))[0].frase).toContain('"call"');
    expect(passoComPendencia(ia({ followup_max_attempts: 0 }))).toBe(7);
  });

  it('em ordem de passo', () => {
    const a = ia({ inbox_id: null, lead_facing_name: null, followup_max_attempts: 0 });
    expect(pendenciasDosPassos(a).map((p) => p.passo)).toEqual([1, 6, 7]);
  });
});
