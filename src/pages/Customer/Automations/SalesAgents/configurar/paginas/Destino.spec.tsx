import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';

vi.mock('@/services/roletaConfig/roletaConfigService', () => ({
  roletaConfigService: {
    getAll: vi.fn().mockResolvedValue([{ id: 'r1', display_name: 'Roleta Centro', inbox_id: 'inbox-1', is_active: true }]),
    getForInbox: vi.fn().mockResolvedValue(null),
  },
}));
vi.mock('@/services/channels/agentsService', () => ({ default: { getAll: vi.fn().mockResolvedValue([{ id: 'u1', name: 'Ana Paula' }]) } }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/services/salesAgents/salesAgentsService', async (original) => {
  const real = await original<typeof import('@/services/salesAgents/salesAgentsService')>();
  return {
    ...real,
    salesAgentsService: {
      ...real.salesAgentsService,
      testNotice: vi.fn().mockResolvedValue({
        ok: true, recipient: 'Ana Paula', sent_to: ['Ana Paula', 'Gestora'],
        lines: ['Pela roleta «Roleta Centro», o próximo da fila agora é Ana Paula.'],
      }),
      cvcrmOptions: vi.fn().mockResolvedValue({
        connected: true, subdomain: 'aurora', empreendimentos: [{ id: 7, nome: 'Residencial Aurora' }], filas: [], errors: {},
      }),
    },
  };
});
import Destino from './Destino';
import { roletaConfigService } from '@/services/roletaConfig/roletaConfigService';
import { salesAgentsService } from '@/services/salesAgents/salesAgentsService';

const consultora = (extra: Partial<SalesAgent> = {}) => agenteDeTeste({ persona_kind: 'assistant', transfer_config: { mode: 'checklist' }, handoff_target: 'roleta', handoff_roleta_config_id: 'r1', handoff_user_id: null, ...extra });

// As listas (roletas e equipe) chegam de forma assíncrona: esperar evita act() fora de hora.
async function abrir(agent: SalesAgent, irPara = vi.fn()) {
  const gravar = gravarDeTeste('destino');
  const r = render(<Destino agent={agent} inboxes={[]} gravar={gravar} irPara={irPara} diagnostico={null} />);
  await waitFor(() => expect(roletaConfigService.getAll).toHaveBeenCalled());
  await act(async () => { await Promise.resolve(); });
  return { gravar, irPara, ...r };
}

describe('Destino', () => {
  it('trocar o cartão NÃO grava: o corretor fixo só vale quando a pessoa é escolhida', async () => {
    const { gravar } = await abrir(consultora());
    await userEvent.click(screen.getByRole('radio', { name: 'Corretor fixo' }));
    expect(gravar).not.toHaveBeenCalled();
    await screen.findByRole('option', { name: 'Ana Paula' });
    await userEvent.selectOptions(screen.getByLabelText('Qual corretor'), 'u1');
    expect(gravar).toHaveBeenCalledWith({ handoff_target: 'user', handoff_user_id: 'u1', handoff_roleta_config_id: null });
  });

  it('Sistema do cliente só vira destino com endereço salvo e chave pronta', async () => {
    const { gravar, rerender } = await abrir(consultora());
    await userEvent.click(screen.getByRole('radio', { name: 'Sistema do cliente' }));
    expect(screen.getByRole('button', { name: 'Usar o sistema do cliente' })).toBeDisabled();
    const pronto = consultora({ handoff_webhook_url: 'https://crm.exemplo.com/leads', handoff_webhook_secret_set: true, handoff_webhook_secret_state: 'ready' });
    rerender(<Destino agent={pronto} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} />);
    expect(screen.getByRole('radio', { name: 'Outro sistema' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Usar o sistema do cliente' }));
    expect(gravar).toHaveBeenCalledWith({ handoff_target: 'webhook', handoff_webhook_system: 'generic', handoff_roleta_config_id: null, handoff_user_id: null });
  });

  it('CVCRM: escolher o sistema não grava; "Usar o CVCRM" só com a conexão; empreendimento grava na hora', async () => {
    const { gravar, rerender } = await abrir(consultora({ handoff_cvcrm_connected: false }));
    await userEvent.click(screen.getByRole('radio', { name: 'Sistema do cliente' }));
    await userEvent.click(screen.getByRole('radio', { name: 'CVCRM' }));
    expect(gravar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Usar o CVCRM' })).toBeDisabled();

    rerender(<Destino agent={consultora({ handoff_cvcrm_connected: true })} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} />);
    await userEvent.selectOptions(await screen.findByLabelText('Empreendimento'), '7');
    expect(gravar).toHaveBeenCalledWith({ handoff_cvcrm: { empreendimento: { id: 7, nome: 'Residencial Aurora' }, fila: null } });
    await userEvent.click(screen.getByRole('button', { name: 'Usar o CVCRM' }));
    expect(gravar).toHaveBeenLastCalledWith({ handoff_target: 'webhook', handoff_webhook_system: 'cvcrm', handoff_roleta_config_id: null, handoff_user_id: null });
  });

  it('IA já no CVCRM abre nele, sem o botão de usar', async () => {
    await abrir(consultora({ handoff_target: 'webhook', handoff_webhook_system: 'cvcrm', handoff_cvcrm_connected: true, handoff_roleta_config_id: null }));
    expect(screen.getByRole('radio', { name: 'CVCRM' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: 'Usar o CVCRM' })).toBeNull();
  });

  it('os quatro cartões; "Fica com o dono do número" grava number_owner sem persona_kind', async () => {
    const { gravar } = await abrir(consultora());
    ['Roleta', 'Corretor fixo', 'Fica com o dono do número', 'Sistema do cliente'].forEach((n) => expect(screen.getByRole('radio', { name: n })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('radio', { name: 'Fica com o dono do número' }));
    expect(gravar).toHaveBeenCalledTimes(1);
    expect(gravar.mock.calls[0]).toEqual([{ handoff_target: 'number_owner', handoff_user_id: null, handoff_roleta_config_id: null }]);
    expect(Object.keys(gravar.mock.calls[0][0])).not.toContain('persona_kind');
  });

  it('o dono do número já gravado vem marcado, com o aviso de teste, e sem escolha de roleta ou corretor', async () => {
    await abrir(consultora({ handoff_target: 'number_owner', handoff_roleta_config_id: null }));
    expect(screen.getByRole('radio', { name: 'Fica com o dono do número' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Mandar um aviso de teste' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Qual roleta')).toBeNull();
  });

  it('sem dono em nenhum número, o cartão do dono fica desabilitado com o motivo', async () => {
    const { gravar } = await abrir(consultora({
      numbers: [{ ...agenteDeTeste().numbers[0], owner_user_id: null, owner_name: null }], number_owner_id: null,
    }));
    await userEvent.click(screen.getByRole('radio', { name: 'Fica com o dono do número' }));
    expect(gravar).not.toHaveBeenCalled();
    expect(screen.getByText(/não tem corretor dono/)).toBeInTheDocument();
  });

  describe('Onde o atendimento continua', () => {
    const inboxes = [{ id: 'inbox-1', name: 'Número da IA', oficial: false }, { id: 'inbox-9', name: 'Atendimento Central', oficial: false }];
    const abrirCom = async (agent: SalesAgent) => {
      const gravar = gravarDeTeste('destino');
      const r = render(<Destino agent={agent} inboxes={inboxes} gravar={gravar} irPara={vi.fn()} diagnostico={null} />);
      await waitFor(() => expect(roletaConfigService.getAll).toHaveBeenCalled());
      await act(async () => { await Promise.resolve(); });
      return { gravar, ...r };
    };
    const MENSAGEM = 'Escreva a mensagem de chegada: é ela que avisa o lead do número novo.';

    it('só aparece com Roleta e Corretor fixo', async () => {
      const { unmount } = await abrirCom(consultora());
      expect(screen.getByRole('radiogroup', { name: 'Onde o atendimento continua' })).toBeInTheDocument();
      unmount();
      const outro = await abrirCom(consultora({ handoff_target: 'user', handoff_user_id: 'u1', handoff_roleta_config_id: null }));
      expect(screen.getByRole('radiogroup', { name: 'Onde o atendimento continua' })).toBeInTheDocument();
      outro.unmount();
      for (const alvo of ['number_owner', 'webhook'] as const) {
        const r = await abrirCom(consultora({ handoff_target: alvo, handoff_roleta_config_id: null }));
        expect(screen.queryByRole('radiogroup', { name: 'Onde o atendimento continua' })).toBeNull();
        r.unmount();
      }
    });

    it('handoff_continue_at nulo aparece em "No número do corretor"', async () => {
      await abrirCom(consultora({ handoff_continue_at: null }));
      expect(screen.getByRole('radio', { name: 'No número do corretor' })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('radio', { name: 'Neste número' })).toHaveAttribute('aria-checked', 'false');
    });

    it('"Neste número" grava na hora', async () => {
      const { gravar } = await abrirCom(consultora());
      await userEvent.click(screen.getByRole('radio', { name: 'Neste número' }));
      expect(gravar).toHaveBeenCalledWith({ handoff_continue_at: 'same_number' });
    });

    it('número de atendimento: sem a mensagem de chegada não grava e diz o que falta', async () => {
      const { gravar } = await abrirCom(consultora());
      await userEvent.click(screen.getByRole('radio', { name: 'Num número de atendimento' }));
      expect(gravar).not.toHaveBeenCalled();
      const opcoes = within(screen.getByLabelText('Número de atendimento')).getAllByRole('option').map((o) => o.textContent);
      expect(opcoes).toEqual(['Escolha o número', 'Atendimento Central']); // o número da própria IA não é "outro" número
      await userEvent.selectOptions(screen.getByLabelText('Número de atendimento'), 'inbox-9');
      expect(gravar).not.toHaveBeenCalled();
      expect(screen.getByText(MENSAGEM)).toBeInTheDocument();
    });

    it('número + mensagem de chegada gravam juntos, com {nome}', async () => {
      const { gravar } = await abrirCom(consultora());
      await userEvent.click(screen.getByRole('radio', { name: 'Num número de atendimento' }));
      await userEvent.selectOptions(screen.getByLabelText('Número de atendimento'), 'inbox-9');
      await userEvent.type(screen.getByLabelText('Mensagem de chegada'), 'Oi, {{nome}! Agora é por aqui.');
      expect(gravar).not.toHaveBeenCalled();
      await userEvent.tab();
      expect(gravar).toHaveBeenCalledWith({ handoff_continue_at: 'service_number', handoff_service_inbox_id: 'inbox-9', handoff_arrival_message: 'Oi, {nome}! Agora é por aqui.' });
    });

    it('mensagem escrita antes do número espera o número, sem gravar pela metade', async () => {
      const { gravar } = await abrirCom(consultora());
      await userEvent.click(screen.getByRole('radio', { name: 'Num número de atendimento' }));
      await userEvent.type(screen.getByLabelText('Mensagem de chegada'), 'Oi!');
      await userEvent.tab();
      expect(gravar).not.toHaveBeenCalled();
      await userEvent.selectOptions(screen.getByLabelText('Número de atendimento'), 'inbox-9');
      expect(gravar).toHaveBeenCalledWith({ handoff_continue_at: 'service_number', handoff_service_inbox_id: 'inbox-9', handoff_arrival_message: 'Oi!' });
    });

    it('apagar a mensagem de um atendimento já gravado não grava e mostra o motivo', async () => {
      const { gravar } = await abrirCom(consultora({ handoff_continue_at: 'service_number', handoff_service_inbox_id: 'inbox-9', handoff_arrival_message: 'Oi!' }));
      expect(screen.getByRole('radio', { name: 'Num número de atendimento' })).toHaveAttribute('aria-checked', 'true');
      await userEvent.clear(screen.getByLabelText('Mensagem de chegada'));
      await userEvent.tab();
      expect(gravar).not.toHaveBeenCalled();
      expect(screen.getByText(MENSAGEM)).toBeInTheDocument();
    });

    it('voltar pro número do corretor grava só o handoff_continue_at', async () => {
      const { gravar } = await abrirCom(consultora({ handoff_continue_at: 'service_number', handoff_service_inbox_id: 'inbox-9', handoff_arrival_message: 'Oi!' }));
      await userEvent.click(screen.getByRole('radio', { name: 'No número do corretor' }));
      expect(gravar).toHaveBeenCalledWith({ handoff_continue_at: 'corretor_number' });
    });
  });

  it('"Depois que ela passa" diz o prazo de 15 minutos e o de 1 hora', async () => {
    await abrir(consultora());
    expect(screen.getByText('Depois que ela passa')).toBeInTheDocument();
    expect(screen.getByText(/ninguém responde em 15 minutos/)).toBeInTheDocument();
    expect(screen.getByText(/com 1 hora, o gerente também/)).toBeInTheDocument();
  });

  it('"a roleta deste número" (antiga): nenhum cartão marcado e o aviso', async () => {
    await abrir(consultora({ handoff_target: 'inbox_roleta', handoff_roleta_config_id: null }));
    screen.getAllByRole('radio').forEach((r) => expect(r).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByText(/uma opção que saiu da tela/)).toBeInTheDocument();
    expect(screen.queryByText('Confirme a roleta')).toBeNull();
  });

  // Roleta nova (06/10/2026): a roleta não tem número; a que atendia o número vem
  // pra confirmar com um clique (porte do passo 2 da main).
  it('"a roleta deste número" (antiga) com roleta no número: confirma a roleta com um clique', async () => {
    vi.mocked(roletaConfigService.getForInbox).mockResolvedValueOnce({ id: 'r1', display_name: 'Roleta Centro', is_active: true } as never);
    const { gravar } = await abrir(consultora({ handoff_target: 'inbox_roleta', handoff_roleta_config_id: null }));
    expect(roletaConfigService.getForInbox).toHaveBeenCalledWith('inbox-1');
    expect(await screen.findByText('Confirme a roleta')).toBeInTheDocument();
    expect(gravar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Usar a roleta Roleta Centro' }));
    expect(gravar).toHaveBeenCalledWith({ handoff_target: 'roleta', handoff_roleta_config_id: 'r1', handoff_user_id: null });
  });

  it('Resumo junto grava por dentro do transfer_config', async () => {
    const { gravar } = await abrir(consultora());
    await userEvent.click(screen.getByRole('switch', { name: 'Mandar o resumo da conversa' }));
    expect(gravar).toHaveBeenCalledWith({ transfer_config: { mode: 'checklist', briefing_enabled: false } }, ['transfer_config.briefing_enabled']);
  });

  it('a roleta escolhida grava o destino completo', async () => {
    const { gravar } = await abrir(consultora({ handoff_target: 'user', handoff_user_id: 'u1', handoff_roleta_config_id: null }));
    await userEvent.click(screen.getByRole('radio', { name: 'Roleta' }));
    await screen.findByRole('option', { name: 'Roleta Centro' });
    await userEvent.selectOptions(screen.getByLabelText('Qual roleta'), 'r1');
    expect(gravar).toHaveBeenCalledWith({ handoff_target: 'roleta', handoff_roleta_config_id: 'r1', handoff_user_id: null });
  });

  it('o endereço grava ao sair do campo', async () => {
    const { gravar } = await abrir(consultora());
    await userEvent.click(screen.getByRole('radio', { name: 'Sistema do cliente' }));
    await userEvent.type(screen.getByLabelText('Endereço do sistema do cliente'), 'https://crm.exemplo.com/leads');
    expect(gravar).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(gravar).toHaveBeenCalledWith({ handoff_webhook_url: 'https://crm.exemplo.com/leads' });
  });

  it('o endereço digitado grava também quando a página some sem sair do campo', async () => {
    const { gravar, unmount } = await abrir(consultora());
    await userEvent.click(screen.getByRole('radio', { name: 'Sistema do cliente' }));
    await userEvent.type(screen.getByLabelText('Endereço do sistema do cliente'), 'https://crm.exemplo.com/leads');
    unmount();
    expect(gravar).toHaveBeenCalledWith({ handoff_webhook_url: 'https://crm.exemplo.com/leads' });
  });

  it('com o sistema do cliente já como destino, apagar o endereço não grava e volta o salvo', async () => {
    const pronto = consultora({ handoff_target: 'webhook', handoff_webhook_url: 'https://crm.exemplo.com/leads', handoff_webhook_secret_set: true, handoff_webhook_secret_state: 'ready' });
    const { gravar } = await abrir(pronto);
    const campo = screen.getByLabelText('Endereço do sistema do cliente');
    await userEvent.clear(campo);
    await userEvent.tab();
    expect(gravar).not.toHaveBeenCalled();
    expect(screen.getByText('Informe o endereço do sistema do cliente')).toBeInTheDocument();
    expect(campo).toHaveValue('https://crm.exemplo.com/leads');
    await userEvent.type(campo, 'x');
    expect(screen.queryByText('Informe o endereço do sistema do cliente')).toBeNull();
  });

  it('endereço inválido não grava e o problema aparece uma vez só', async () => {
    const { gravar } = await abrir(consultora());
    await userEvent.click(screen.getByRole('radio', { name: 'Sistema do cliente' }));
    await userEvent.type(screen.getByLabelText('Endereço do sistema do cliente'), 'http://inseguro');
    await userEvent.tab();
    expect(gravar).not.toHaveBeenCalled();
    expect(screen.getAllByText(/https/i).filter((e) => e.className.includes('amber') || e.className.includes('destructive'))).toHaveLength(1);
  });

  describe('Mandar um aviso de teste', () => {
    it('com a roleta gravada, manda e mostra pra quem foi e o que aconteceria', async () => {
      await abrir(consultora());
      await userEvent.click(screen.getByRole('button', { name: 'Mandar um aviso de teste' }));
      expect(salesAgentsService.testNotice).toHaveBeenCalledWith('ia-1');
      expect(await screen.findByText('Aviso de teste enviado pra Ana Paula e Gestora.')).toBeInTheDocument();
      expect(screen.getByText('Pela roleta «Roleta Centro», o próximo da fila agora é Ana Paula.')).toBeInTheDocument();
    });

    it('trocar de roleta apaga o resultado do teste da roleta anterior', async () => {
      const { gravar, rerender } = await abrir(consultora());
      await userEvent.click(screen.getByRole('button', { name: 'Mandar um aviso de teste' }));
      expect(await screen.findByText(/o próximo da fila agora é Ana Paula/)).toBeInTheDocument();
      rerender(<Destino agent={consultora({ handoff_roleta_config_id: 'r2' })} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} />);
      expect(screen.queryByText(/o próximo da fila agora é Ana Paula/)).toBeNull();
    });

    it('escolha pela metade não mostra o botão: o servidor testa o destino gravado', async () => {
      await abrir(consultora());
      await userEvent.click(screen.getByRole('radio', { name: 'Corretor fixo' }));
      expect(screen.queryByRole('button', { name: 'Mandar um aviso de teste' })).toBeNull();
    });

    it('sem pra quem mandar, mostra o motivo do servidor', async () => {
      vi.mocked(salesAgentsService.testNotice).mockResolvedValueOnce({ ok: false, error: 'No atendimento real, o lead ficaria sem ninguém: a roleta «Centro» está desativada.' });
      await abrir(consultora());
      await userEvent.click(screen.getByRole('button', { name: 'Mandar um aviso de teste' }));
      expect(await screen.findByText(/ficaria sem ninguém/)).toBeInTheDocument();
    });

  });
});
