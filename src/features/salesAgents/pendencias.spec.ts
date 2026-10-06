import { describe, expect, it } from 'vitest';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { FRASE_SEM_DONO, motivoSemEscolhaDoFollowup, passoComPendencia, pendenciasDosPassos, podeLigar } from './pendencias';

const ia = (extra: Partial<SalesAgent> = {}) =>
  ({
    persona_kind: 'owner', reach: 'qualify', transfer_config: { mode: 'checklist' }, handoff_target: 'inbox_roleta',
    handoff_roleta_config_id: null, handoff_user_id: null, lead_facing_name: 'Bia', inbox_id: 'inbox-1',
    number_owner_id: 'u7', qualification_questions: ['Renda'], trigger_keyword: null,
    followup_enabled: true, followup_action: 'sequence', followup_flow_id: 'fu-1', ...extra,
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

  // IA antiga: fala como o corretor e entrega pra um fixo. Revisar, sem travar.
  it('corretor com destino que não é o dono do número: aviso no passo 2, sem travar', () => {
    const a = ia({ persona_kind: 'broker', handoff_target: 'user', handoff_user_id: 'u9' });
    expect(pendenciasDosPassos(a)).toEqual([expect.objectContaining({ chave: 'persona_destino', passo: 2, impedeLigar: false })]);
    expect(podeLigar(a).pode).toBe(true);
  });

  it('sem o nome que o lead vê: passo 1, só aviso (não trava o Ligar)', () => {
    const a = ia({ lead_facing_name: '  ' });
    expect(pendenciasDosPassos(a)[0]).toMatchObject({ passo: 1, chave: 'nome_visivel', impedeLigar: false });
    expect(podeLigar(a)).toEqual({ pode: true, motivo: null });
  });

  it('roleta ou corretor sem escolha, perguntas vazias, palavra antiga e follow-up ainda em "A IA escreve"', () => {
    expect(passoComPendencia(ia({ handoff_target: 'roleta' }))).toBe(2);
    expect(passoComPendencia(ia({ handoff_target: 'user' }))).toBe(2);
    expect(passoComPendencia(ia({ qualification_questions: [' '] }))).toBe(3);
    expect(pendenciasDosPassos(ia({ trigger_keyword: 'call' }))[0].frase).toContain('"call"');
    expect(passoComPendencia(ia({ followup_action: 'ai' }))).toBe(7);
    expect(pendenciasDosPassos(ia({ followup_action: 'ai' }))[0]).toMatchObject({ chave: 'followup_sem_escolha', impedeLigar: false });
    // O teto de tentativas saiu da tela (06/10/2026): máximo 0 não é mais pendência.
    expect(pendenciasDosPassos(ia({ followup_max_attempts: 0 }))).toEqual([]);
  });

  // 06/10/2026: follow-up ligado precisa de uma saída válida.
  it('follow-up sem escolha (vazio) e "Entregar pro follow-up" sem follow-up: passo 7, laranja', () => {
    expect(pendenciasDosPassos(ia({ followup_action: undefined }))).toEqual([
      expect.objectContaining({ chave: 'followup_sem_escolha', passo: 7, frase: 'Escolha o que ela faz quando o lead some.', impedeLigar: false }),
    ]);
    expect(pendenciasDosPassos(ia({ followup_flow_id: null }))).toEqual([
      expect.objectContaining({ chave: 'followup_sem_fluxo', passo: 7, frase: 'Falta escolher o follow-up que recebe o lead.', impedeLigar: false }),
    ]);
    // Funil antigo (só o slug) tem destino: não é pendência aqui.
    expect(pendenciasDosPassos(ia({ followup_flow_id: null, followup_sequence_slug: 'follow-up-longo' }))).toEqual([]);
    // Follow-up desligado: nada.
    expect(pendenciasDosPassos(ia({ followup_enabled: false, followup_flow_id: null }))).toEqual([]);
    expect(pendenciasDosPassos(ia({ followup_enabled: false, followup_action: 'ai' }))).toEqual([]);
  });

  it('o motivo que trava o Salvar do passo 7', () => {
    expect(motivoSemEscolhaDoFollowup({ followup_enabled: true, followup_action: 'ai' })).toBe('Escolha como o follow-up continua: a IA não escreve mais o follow-up.');
    expect(motivoSemEscolhaDoFollowup({ followup_enabled: true })).toBe('Escolha o que ela faz quando o lead some.');
    expect(motivoSemEscolhaDoFollowup({ followup_enabled: true, followup_action: 'pipeline' })).toBeNull();
    expect(motivoSemEscolhaDoFollowup({ followup_enabled: false, followup_action: 'ai' })).toBeNull();
  });

  it('sistema do cliente sem endereço: passo 2, sem travar', () => {
    const a = ia({ handoff_target: 'webhook', handoff_webhook_url: null } as Partial<SalesAgent>);
    expect(pendenciasDosPassos(a)).toContainEqual(expect.objectContaining({ chave: 'destino_sem_endereco', passo: 2, impedeLigar: false }));
  });

  it('sistema do cliente sem chave pronta trava o Ligar', () => {
    const a = ia({ handoff_target: 'webhook', handoff_webhook_url: 'https://crm.exemplo.com.br/x', handoff_webhook_secret_state: 'none' } as Partial<SalesAgent>);
    expect(pendenciasDosPassos(a)).toEqual([expect.objectContaining({ chave: 'destino_sem_chave', passo: 2, impedeLigar: true })]);
    expect(podeLigar(a).pode).toBe(false);
    expect(pendenciasDosPassos({ ...a, handoff_webhook_secret_state: 'ready' })).toEqual([]);
  });

  it('em ordem de passo', () => {
    const a = ia({ inbox_id: null, lead_facing_name: null, followup_action: 'ai' });
    expect(pendenciasDosPassos(a).map((p) => p.passo)).toEqual([1, 6, 7]);
  });
});
