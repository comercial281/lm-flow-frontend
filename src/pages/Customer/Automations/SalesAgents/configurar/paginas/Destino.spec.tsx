import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
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
      cvcrmOptions: vi.fn().mockResolvedValue({
        connected: true, subdomain: 'aurora', empreendimentos: [{ id: 7, nome: 'Residencial Aurora' }], filas: [], errors: {},
      }),
    },
  };
});
import Destino from './Destino';
import { roletaConfigService } from '@/services/roletaConfig/roletaConfigService';

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

  // Review Focus 5: a persona virou corretor com a página aberta.
  it('persona virou O corretor com a página aberta: trava, e a escolha pela metade some sem gravar', async () => {
    const { gravar, rerender, irPara } = await abrir(consultora());
    await userEvent.click(screen.getByRole('radio', { name: 'Corretor fixo' }));
    rerender(<Destino agent={agenteDeTeste({ handoff_target: 'number_owner', handoff_user_id: null })} inboxes={[]} gravar={gravar} irPara={irPara} diagnostico={null} />);
    expect(screen.getByText('Fica com o dono do número')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Corretor fixo' })).toBeNull();
    expect(gravar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Mudar persona' }));
    expect(irPara).toHaveBeenCalledWith('identidade');
  });

  it('IA antiga de corretor com corretor fixo: aviso e conversão explícita', async () => {
    const { gravar } = await abrir(agenteDeTeste()); // broker + handoff user
    await userEvent.click(screen.getByRole('button', { name: 'Passar a entregar pro dono do número' }));
    expect(gravar).toHaveBeenCalledWith({ persona_kind: 'broker', handoff_target: 'number_owner', handoff_user_id: null, handoff_roleta_config_id: null });
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
});
