import { describe, expect, it } from 'vitest';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { FRASE_SEM_DONO, motivoSemEscolhaDoFollowup, paginasComPendencia, pendenciasDasPaginas, podeLigar } from './pendencias';

const chaves = (a: Parameters<typeof pendenciasDasPaginas>[0]) => pendenciasDasPaginas(a).map((p) => `${p.pagina}:${p.chave}`);

describe('pendenciasDasPaginas', () => {
  it('sem número trava o Ligar e aponta Números e usuários', () => {
    const a = agenteDeTeste({ inbox_id: null, lead_facing_name: 'Bia' });
    expect(chaves(a)).toContain('numeros:sem_numero');
    expect(podeLigar(a)).toEqual({ pode: false, motivo: 'Falta o número de WhatsApp.', pagina: 'numeros' });
  });

  it('nome que o lead vê é opcional: sem ele não há pendência (11/10/2026)', () => {
    const a = agenteDeTeste({ lead_facing_name: null });
    expect(chaves(a)).not.toContain('identidade:nome_visivel');
    expect(pendenciasDasPaginas(a).map((p) => p.chave)).not.toContain('nome_visivel');
    expect(podeLigar(a).pode).toBe(true);
  });

  it('palavra antiga usa a frase nova', () => {
    const p = pendenciasDasPaginas(agenteDeTeste({ trigger_keyword: 'mcmv' })).find((x) => x.chave === 'palavra_antiga');
    expect(p?.frase).toBe('Ainda vale a regra antiga da palavra "mcmv".');
  });

  it('corretor sem dono do número trava, em Números e usuários', () => {
    const a = agenteDeTeste({ persona_kind: 'broker', number_owner_id: null, handoff_target: 'number_owner', lead_facing_name: 'Bia' });
    expect(podeLigar(a)).toMatchObject({ pode: false, pagina: 'numeros' });
  });

  it('destino incompleto e o antigo "roleta deste número" vão pro Destino', () => {
    expect(chaves(agenteDeTeste({ persona_kind: 'assistant', handoff_target: 'roleta', handoff_roleta_config_id: null }))).toContain('destino:destino_sem_roleta');
    expect(chaves(agenteDeTeste({ persona_kind: 'assistant', handoff_target: 'inbox_roleta' }))).toContain('destino:destino_antigo');
    expect(podeLigar(agenteDeTeste({ persona_kind: 'assistant', handoff_target: 'webhook', handoff_webhook_url: 'https://x', handoff_webhook_secret_state: 'none', lead_facing_name: 'Bia' })))
      .toMatchObject({ pode: false, pagina: 'destino' });
  });

  it('perguntas vazias com o critério das obrigatórias vão pra Condução', () => {
    expect(chaves(agenteDeTeste({ qualification_questions: [], transfer_config: { mode: 'checklist' } }))).toContain('conducao:perguntas_vazias');
  });

  it('palavra antiga vai pra Campanhas e gatilhos; follow-up sem escolha vai pro Funil e follow-up', () => {
    expect(chaves(agenteDeTeste({ trigger_keyword: 'mcmv' }))).toContain('campanhas:palavra_antiga');
    expect(chaves(agenteDeTeste({ followup_enabled: true, followup_action: 'ai' }))).toContain('funil:followup_sem_escolha');
  });

  it('a lista sai na ordem do trilho e o conjunto marca as páginas', () => {
    const a = agenteDeTeste({
      inbox_id: null, lead_facing_name: null, trigger_keyword: 'x',
      persona_kind: 'assistant', handoff_target: 'roleta', handoff_roleta_config_id: 'r1',
    });
    expect(pendenciasDasPaginas(a).map((p) => p.pagina)).toEqual(['numeros', 'campanhas']);
    expect([...paginasComPendencia(a)]).toEqual(['numeros', 'campanhas']);
    const b = agenteDeTeste({ persona_kind: 'broker', number_owner_id: null, handoff_target: 'number_owner', inbox_id: 'i1', trigger_keyword: 'x' });
    expect(pendenciasDasPaginas(b).map((p) => p.pagina)).toEqual(['numeros', 'campanhas']);
    expect([...paginasComPendencia(b)]).toEqual(['numeros', 'campanhas']);
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
    expect(pendenciasDasPaginas(a)[0]).toMatchObject({ pagina: 'numeros', frase: FRASE_SEM_DONO, impedeLigar: true });
  });

  it('corretor com destino que não é o dono: aviso no Destino, sem travar', () => {
    const a = agenteDeTeste({ persona_kind: 'broker', handoff_target: 'user', handoff_user_id: 'u9', lead_facing_name: 'Bia' });
    expect(pendenciasDasPaginas(a)).toEqual([expect.objectContaining({ chave: 'persona_destino', pagina: 'destino', impedeLigar: false })]);
    expect(podeLigar(a).pode).toBe(true);
  });

  it('follow-up: sem escolha, sem follow-up escolhido, funil antigo e desligado', () => {
    const base = { lead_facing_name: 'Bia', persona_kind: 'assistant' as const };
    expect(pendenciasDasPaginas(agenteDeTeste({ ...base, followup_action: undefined }))).toEqual([
      expect.objectContaining({ chave: 'followup_sem_escolha', pagina: 'funil', frase: 'Escolha o que ela faz quando o lead some.' }),
    ]);
    expect(pendenciasDasPaginas(agenteDeTeste({ ...base, followup_flow_id: null }))).toEqual([
      expect.objectContaining({ chave: 'followup_sem_fluxo', pagina: 'funil', frase: 'Falta escolher o follow-up que recebe o lead.' }),
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

const numero = (extra: Partial<SalesAgent['numbers'][number]> = {}) => ({
  id: 'num-1', inbox_id: 'inbox-1', phone: null, inbox_name: 'Ana', enabled: true, connected: true, voice: null, triggers: null,
  position: 0, owner_user_id: 'user-7', owner_name: 'Dona do número', ...extra,
});
const completo = (extra: Partial<SalesAgent> = {}) => agenteDeTeste({ lead_facing_name: 'Bia', persona_kind: 'assistant', ...extra });

describe('pendenciasDasPaginas: o que a reestruturação acrescenta', () => {
  it('Filtra e passa sem pergunta nenhuma impede ligar, em Condução, com a frase da spec', () => {
    const a = completo({ job: 'filtra_passa', qualification_questions: [], transfer_config: { mode: 'checklist', required_questions: [] } });
    const p = pendenciasDasPaginas(a).find((x) => x.chave === 'filtra_sem_obrigatoria');
    expect(p).toMatchObject({ pagina: 'conducao', impedeLigar: true, frase: 'Filtra e passa precisa de pelo menos uma pergunta obrigatória.' });
    expect(podeLigar(a)).toEqual({ pode: false, motivo: 'Filtra e passa precisa de pelo menos uma pergunta obrigatória.', pagina: 'conducao' });
  });

  it('nenhuma marcada vale como todas (como o servidor): com perguntas, não pede', () => {
    const a = completo({ job: 'filtra_passa', qualification_questions: ['Renda'], transfer_config: { mode: 'checklist', required_questions: [] } });
    expect(chaves(a)).not.toContain('conducao:filtra_sem_obrigatoria');
  });

  it('Leva até a visita não pede obrigatória (as perguntas não seguram a marcação)', () => {
    const a = completo({ job: 'leva_visita', qualification_questions: [], transfer_config: { required_questions: [] } });
    expect(chaves(a)).not.toContain('conducao:filtra_sem_obrigatoria');
  });

  it('sem trabalho gravado, o trabalho segue o servidor: agendar visita é booking_enabled != false (não o reach)', () => {
    const base = { job: null, qualification_questions: [], transfer_config: { required_questions: [] } } as Partial<SalesAgent>;
    expect(chaves(completo({ ...base, booking_enabled: false, reach: 'visit' }))).toContain('conducao:filtra_sem_obrigatoria');
    expect(chaves(completo({ ...base, booking_enabled: true, reach: 'qualify' }))).not.toContain('conducao:filtra_sem_obrigatoria');
    expect(chaves(completo({ ...base, booking_enabled: undefined, reach: 'qualify' }))).not.toContain('conducao:filtra_sem_obrigatoria');
  });

  it('reunião nos próximos passos sem endereço do escritório avisa em Modo operante', () => {
    const sem = completo({ job: 'leva_visita', next_steps: ['visita', 'reuniao'], house_voice: { kind: 'consultora', name: 'Ana', gender: 'ela' } });
    expect(pendenciasDasPaginas(sem)).toContainEqual(expect.objectContaining({
      chave: 'reuniao_sem_endereco', pagina: 'modo', impedeLigar: false,
      frase: 'A reunião no escritório está nos próximos passos, mas falta o endereço do escritório na ficha da casa: ela não é oferecida.',
    }));
    // No Filtra e passa ela não marca nada: a reunião é oferecida, sem o endereço (como o servidor, 02/11/26).
    const filtra = completo({ job: 'filtra_passa', next_steps: ['reuniao'], house_voice: { kind: 'consultora', name: 'Ana', gender: 'ela' } });
    expect(pendenciasDasPaginas(filtra)).toContainEqual(expect.objectContaining({
      chave: 'reuniao_sem_endereco',
      frase: 'A reunião no escritório está nos próximos passos, mas falta o endereço do escritório na ficha da casa: ela é oferecida, mas sem o endereço.',
    }));
    const com = completo({ next_steps: ['reuniao'], house_voice: { kind: 'consultora', office_address: 'Rua A, 10' } });
    expect(chaves(com)).not.toContain('modo:reuniao_sem_endereco');
    expect(chaves(completo({ next_steps: ['visita'] }))).not.toContain('modo:reuniao_sem_endereco');
  });

  it('voz Corretor num número sem dono impede ligar, em Números e usuários', () => {
    const casa = completo({ house_voice: { kind: 'corretor' }, handoff_target: 'number_owner', numbers: [numero({ owner_user_id: null, owner_name: null })] });
    expect(pendenciasDasPaginas(casa)).toContainEqual(expect.objectContaining({
      chave: 'corretor_sem_dono_do_numero', pagina: 'numeros', impedeLigar: true,
      frase: 'O número Ana está com a voz Corretor e não tem corretor dono. Escolha o dono em Integrações → WhatsApp ou use outra voz.',
    }));
    const semNome = completo({ house_voice: { kind: 'corretor' }, handoff_target: 'number_owner', numbers: [numero({ inbox_name: '', owner_user_id: null })] });
    expect(pendenciasDasPaginas(semNome)[0].frase).toMatch(/^Este número está com a voz Corretor/);
    const propria = completo({ numbers: [numero({ voice: { kind: 'corretor' }, owner_user_id: null }), numero({ id: 'n2', inbox_id: 'inbox-2', owner_user_id: 'u1' })] });
    expect(chaves(propria)).toContain('numeros:corretor_sem_dono_do_numero');
    // a corretora com ficha própria de outra voz não depende de dono; número desligado não conta.
    expect(chaves(completo({ house_voice: { kind: 'corretor' }, handoff_target: 'number_owner', numbers: [numero({ voice: { kind: 'consultora' }, owner_user_id: null })] })))
      .not.toContain('numeros:corretor_sem_dono_do_numero');
    expect(chaves(completo({ house_voice: { kind: 'corretor' }, handoff_target: 'number_owner', numbers: [numero({ enabled: false, owner_user_id: null })] })))
      .not.toContain('numeros:corretor_sem_dono_do_numero');
  });

  it('número de atendimento apagado depois (dado parado) só avisa: o servidor não confere ao ligar', () => {
    const a = completo({ handoff_target: 'roleta', handoff_roleta_config_id: 'r1', handoff_continue_at: 'service_number', handoff_service_inbox_id: null, handoff_arrival_message: 'Oi {nome}' });
    expect(pendenciasDasPaginas(a)).toContainEqual(expect.objectContaining({ chave: 'continua_sem_mensagem', pagina: 'destino', impedeLigar: false }));
    expect(podeLigar(a).pode).toBe(true);
  });

  it('número de atendimento sem mensagem de chegada impede ligar, em Destino', () => {
    const base = { handoff_target: 'roleta' as const, handoff_roleta_config_id: 'r1', handoff_continue_at: 'service_number' as const, handoff_service_inbox_id: 'inbox-9' };
    const sem = completo({ ...base, handoff_arrival_message: '  ' });
    expect(pendenciasDasPaginas(sem)).toContainEqual(expect.objectContaining({
      chave: 'continua_sem_mensagem', pagina: 'destino', impedeLigar: true,
      frase: 'Escreva a mensagem de chegada: é ela que avisa o lead do número novo.',
    }));
    expect(chaves(completo({ ...base, handoff_arrival_message: 'Oi {nome}, agora é por aqui.' }))).not.toContain('destino:continua_sem_mensagem');
    expect(chaves(completo({ ...base, handoff_continue_at: 'corretor_number', handoff_arrival_message: null }))).not.toContain('destino:continua_sem_mensagem');
  });
});

describe('podeLigar com o número dividido', () => {
  const dividido = (extra: Partial<SalesAgent> = {}) => completo({ id: 'ia-a', name: 'Agente A', enabled: false, numbers: [numero()], ...extra });
  const outro = (extra: Partial<SalesAgent> = {}) => agenteDeTeste({ id: 'ia-b', name: 'Agente B', enabled: true, numbers: [numero({ id: 'num-b' })], ...extra });

  it('outro agente ligado atendendo todo lead no mesmo número: recusa e leva aos gatilhos', () => {
    expect(podeLigar(dividido(), [outro()])).toEqual({
      pode: false, pagina: 'campanhas', motivo: 'Pra dividir o número Ana com o agente Agente B, os dois precisam de gatilhos.',
    });
  });

  it('número sem nome não vira "null" no motivo', () => {
    const a = dividido({ numbers: [numero({ inbox_name: '' })] });
    expect(podeLigar(a, [outro()]).motivo).toBe('Pra dividir o número sem nome com o agente Agente B, os dois precisam de gatilhos.');
  });

  it('o outro desligado não conta', () => {
    expect(podeLigar(dividido(), [outro({ enabled: false })]).pode).toBe(true);
  });

  it('juntado e o próprio agente na lista não contam', () => {
    expect(podeLigar(dividido(), [outro({ absorbed_into_id: 'ia-x' }), dividido()]).pode).toBe(true);
  });

  it('número diferente não divide', () => {
    expect(podeLigar(dividido(), [outro({ numbers: [numero({ inbox_id: 'inbox-2' })] })]).pode).toBe(true);
  });

  it('os dois com gatilho: pode', () => {
    const gatilho = [{ type: 'tag' as const, value: 'quente' }];
    const b = outro({ triggers: [{ type: 'tag', value: 'frio' }] });
    expect(podeLigar(dividido({ triggers: gatilho }), [b]).pode).toBe(true);
  });

  it('este sem gatilho e o outro com gatilho: recusa (cada um precisa de gatilho)', () => {
    const b = outro({ triggers: [{ type: 'tag', value: 'frio' }] });
    expect(podeLigar(dividido({ triggers: [] }), [b])).toMatchObject({ pode: false, pagina: 'campanhas' });
  });

  it('gatilho próprio do número vale sobre o do agente', () => {
    const gatilho = [{ type: 'tag' as const, value: 'quente' }];
    const a = dividido({ triggers: [], numbers: [numero({ triggers: gatilho })] });
    const b = outro({ triggers: [], numbers: [numero({ id: 'num-b', triggers: [{ type: 'tag', value: 'frio' }] })] });
    expect(podeLigar(a, [b]).pode).toBe(true);
  });

  it('sem a lista dos outros, só as travas do próprio agente', () => {
    expect(podeLigar(dividido()).pode).toBe(true);
  });
});
