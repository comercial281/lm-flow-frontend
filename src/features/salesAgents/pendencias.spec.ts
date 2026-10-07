import { describe, expect, it } from 'vitest';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { FRASE_SEM_DONO, motivoSemEscolhaDoFollowup, paginasComPendencia, pendenciasDasPaginas, podeLigar } from './pendencias';

const chaves = (a: Parameters<typeof pendenciasDasPaginas>[0]) => pendenciasDasPaginas(a).map((p) => `${p.pagina}:${p.chave}`);

describe('pendenciasDasPaginas', () => {
  it('sem número trava o Ligar e aponta Canal', () => {
    const a = agenteDeTeste({ inbox_id: null, lead_facing_name: 'Bia' });
    expect(chaves(a)).toContain('canal:sem_numero');
    expect(podeLigar(a)).toEqual({ pode: false, motivo: 'Falta o número de WhatsApp.', pagina: 'canal' });
  });

  it('nome que o lead vê só avisa, em Identidade', () => {
    const a = agenteDeTeste({ lead_facing_name: null });
    expect(chaves(a)).toContain('identidade:nome_visivel');
    expect(podeLigar(a).pode).toBe(true);
  });

  it('corretor sem dono do número trava, em Identidade', () => {
    const a = agenteDeTeste({ persona_kind: 'broker', number_owner_id: null, handoff_target: 'number_owner', lead_facing_name: 'Bia' });
    expect(podeLigar(a)).toMatchObject({ pode: false, pagina: 'identidade' });
  });

  it('destino incompleto e o antigo "roleta deste número" vão pro Destino', () => {
    expect(chaves(agenteDeTeste({ persona_kind: 'assistant', handoff_target: 'roleta', handoff_roleta_config_id: null }))).toContain('destino:destino_sem_roleta');
    expect(chaves(agenteDeTeste({ persona_kind: 'assistant', handoff_target: 'inbox_roleta' }))).toContain('destino:destino_antigo');
    expect(podeLigar(agenteDeTeste({ persona_kind: 'assistant', handoff_target: 'webhook', handoff_webhook_url: 'https://x', handoff_webhook_secret_state: 'none', lead_facing_name: 'Bia' })))
      .toMatchObject({ pode: false, pagina: 'destino' });
  });

  it('perguntas vazias com o critério das obrigatórias vão pra Qualificação', () => {
    expect(chaves(agenteDeTeste({ qualification_questions: [], transfer_config: { mode: 'checklist' } }))).toContain('qualificacao:perguntas_vazias');
  });

  it('palavra antiga vai pro Canal; follow-up sem escolha vai pro Follow-up', () => {
    expect(chaves(agenteDeTeste({ trigger_keyword: 'mcmv' }))).toContain('canal:palavra_antiga');
    expect(chaves(agenteDeTeste({ followup_enabled: true, followup_action: 'ai' }))).toContain('followup:followup_sem_escolha');
  });

  it('a lista sai na ordem do trilho e o conjunto marca as páginas', () => {
    const a = agenteDeTeste({
      inbox_id: null, lead_facing_name: null, trigger_keyword: 'x',
      persona_kind: 'assistant', handoff_target: 'roleta', handoff_roleta_config_id: 'r1',
    });
    expect(pendenciasDasPaginas(a).map((p) => p.pagina)).toEqual(['canal', 'canal', 'identidade']);
    expect([...paginasComPendencia(a)]).toEqual(['canal', 'identidade']);
  });
});

describe('pendenciasDasPaginas: casos que o passo a passo já cobria', () => {
  it('IA completa: nenhuma, e o Ligar está livre', () => {
    const a = agenteDeTeste({ lead_facing_name: 'Bia', persona_kind: 'assistant' });
    expect(pendenciasDasPaginas(a)).toEqual([]);
    expect(podeLigar(a)).toEqual({ pode: true, motivo: null, pagina: null });
  });

  it('corretor sem dono traz a frase da casa', () => {
    const a = agenteDeTeste({ persona_kind: 'broker', handoff_target: 'number_owner', number_owner_id: null, lead_facing_name: 'Bia' });
    expect(pendenciasDasPaginas(a)[0]).toMatchObject({ pagina: 'identidade', frase: FRASE_SEM_DONO, impedeLigar: true });
  });

  it('corretor com destino que não é o dono: aviso no Destino, sem travar', () => {
    const a = agenteDeTeste({ persona_kind: 'broker', handoff_target: 'user', handoff_user_id: 'u9', lead_facing_name: 'Bia' });
    expect(pendenciasDasPaginas(a)).toEqual([expect.objectContaining({ chave: 'persona_destino', pagina: 'destino', impedeLigar: false })]);
    expect(podeLigar(a).pode).toBe(true);
  });

  it('follow-up: sem escolha, sem follow-up escolhido, funil antigo e desligado', () => {
    const base = { lead_facing_name: 'Bia', persona_kind: 'assistant' as const };
    expect(pendenciasDasPaginas(agenteDeTeste({ ...base, followup_action: undefined }))).toEqual([
      expect.objectContaining({ chave: 'followup_sem_escolha', pagina: 'followup', frase: 'Escolha o que ela faz quando o lead some.' }),
    ]);
    expect(pendenciasDasPaginas(agenteDeTeste({ ...base, followup_flow_id: null }))).toEqual([
      expect.objectContaining({ chave: 'followup_sem_fluxo', pagina: 'followup', frase: 'Falta escolher o follow-up que recebe o lead.' }),
    ]);
    expect(pendenciasDasPaginas(agenteDeTeste({ ...base, followup_flow_id: null, followup_sequence_slug: 'follow-up-longo' }))).toEqual([]);
    expect(pendenciasDasPaginas(agenteDeTeste({ ...base, followup_enabled: false, followup_action: 'ai' }))).toEqual([]);
  });

  it('o motivo que trava a página Follow-up', () => {
    expect(motivoSemEscolhaDoFollowup({ followup_enabled: true, followup_action: 'ai' })).toBe('Escolha como o follow-up continua: a IA não escreve mais o follow-up.');
    expect(motivoSemEscolhaDoFollowup({ followup_enabled: true })).toBe('Escolha o que ela faz quando o lead some.');
    expect(motivoSemEscolhaDoFollowup({ followup_enabled: true, followup_action: 'pipeline' })).toBeNull();
    expect(motivoSemEscolhaDoFollowup({ followup_enabled: false, followup_action: 'ai' })).toBeNull();
  });

  it('sistema do cliente: sem endereço avisa; sem chave pronta trava', () => {
    const sem = agenteDeTeste({ persona_kind: 'assistant', handoff_target: 'webhook', handoff_webhook_url: null, lead_facing_name: 'Bia' });
    expect(pendenciasDasPaginas(sem)).toContainEqual(expect.objectContaining({ chave: 'destino_sem_endereco', pagina: 'destino', impedeLigar: false }));
    const semChave = { ...sem, handoff_webhook_url: 'https://crm.exemplo.com.br/x', handoff_webhook_secret_state: 'none' } as typeof sem;
    expect(pendenciasDasPaginas(semChave)).toEqual([expect.objectContaining({ chave: 'destino_sem_chave', impedeLigar: true })]);
    expect(pendenciasDasPaginas({ ...semChave, handoff_webhook_secret_state: 'ready' })).toEqual([]);
  });

  it('o antigo "roleta deste número" não leva o aviso quando a persona é o corretor', () => {
    expect(chaves(agenteDeTeste({ persona_kind: 'broker', handoff_target: 'inbox_roleta', lead_facing_name: 'Bia' }))).not.toContain('destino:destino_antigo');
  });

  it('CVCRM: sem pedir endereço nem chave; sem conexão trava o Ligar', () => {
    const a = agenteDeTeste({ persona_kind: 'assistant', handoff_target: 'webhook', handoff_webhook_system: 'cvcrm', handoff_webhook_url: null,
      handoff_webhook_secret_state: 'none', handoff_cvcrm_connected: true, lead_facing_name: 'Bia' });
    expect(pendenciasDasPaginas(a)).toEqual([]);

    const desconectado = { ...a, handoff_cvcrm_connected: false };
    expect(pendenciasDasPaginas(desconectado)).toEqual([
      expect.objectContaining({ chave: 'destino_cvcrm_desconectado', pagina: 'destino', impedeLigar: true }),
    ]);
    expect(podeLigar(desconectado)).toMatchObject({ pode: false, motivo: expect.stringContaining('Integrações → CVCRM'), pagina: 'destino' });
  });
});
