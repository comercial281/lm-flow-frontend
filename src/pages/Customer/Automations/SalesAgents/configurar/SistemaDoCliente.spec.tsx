import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Sistema do cliente (05/10/2026): endereço, chave (mostrada UMA vez) e o lead de
// teste com a resposta do sistema do cliente na tela.
const servico = vi.hoisted(() => ({ generateWebhookSecret: vi.fn(), testWebhook: vi.fn() }));
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: servico }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import SistemaDoCliente from './SistemaDoCliente';

const URL_SALVA = 'https://crm.imobiliaria-exemplo.com.br/lmflow';

function montar(parcial: Partial<Parameters<typeof SistemaDoCliente>[0]> = {}) {
  const props = {
    agentId: 'a1',
    url: URL_SALVA,
    urlSalva: URL_SALVA,
    chaveGerada: false,
    onUrlChange: vi.fn(),
    onChaveGerada: vi.fn(),
    ...parcial,
  };
  render(<SistemaDoCliente {...props} />);
  return props;
}

beforeEach(() => {
  servico.generateWebhookSecret.mockReset();
  servico.testWebhook.mockReset();
});

describe('SistemaDoCliente', () => {
  it('gerar a chave mostra UMA vez e avisa que não aparece de novo', async () => {
    servico.generateWebhookSecret.mockResolvedValue('lmf_whsec_abc123');
    const user = userEvent.setup();
    const props = montar();

    await user.click(screen.getByRole('button', { name: /gerar chave secreta/i }));

    expect(await screen.findByText('lmf_whsec_abc123')).toBeInTheDocument();
    expect(screen.getByText(/não aparece de novo/i)).toBeInTheDocument();
    expect(props.onChaveGerada).toHaveBeenCalled();
  });

  it('com chave já gerada, pede confirmação antes de gerar outra', async () => {
    servico.generateWebhookSecret.mockResolvedValue('lmf_whsec_nova');
    const user = userEvent.setup();
    montar({ chaveGerada: true });

    await user.click(screen.getByRole('button', { name: /gerar outra chave/i }));
    expect(servico.generateWebhookSecret).not.toHaveBeenCalled();
    expect(screen.getByText(/para de valer na hora/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sim, gerar outra/i }));
    await waitFor(() => expect(servico.generateWebhookSecret).toHaveBeenCalledWith('a1', { confirm: true }));
  });

  it('chave ilegível no servidor: avisa e oferece gerar outra', () => {
    montar({ chaveGerada: true, chaveIlegivel: true });
    expect(screen.getByText(/a chave gravada não abre mais/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gerar outra chave/i })).toBeInTheDocument();
  });

  it('teste fica bloqueado com endereço não salvo', () => {
    montar({ url: 'https://outro.exemplo.com.br/x', chaveGerada: true });

    expect(screen.getByRole('button', { name: /mandar um lead de teste/i })).toBeDisabled();
    expect(screen.getByText('Salve o endereço antes de testar.')).toBeInTheDocument();
  });

  it('teste mostra o que o sistema do cliente respondeu', async () => {
    servico.testWebhook.mockResolvedValue({
      ok: true,
      response_code: 200,
      response_excerpt: '{"recebido":true}',
      duration_ms: 312,
      error: null,
    });
    const user = userEvent.setup();
    montar({ chaveGerada: true });

    await user.click(screen.getByRole('button', { name: /mandar um lead de teste/i }));

    expect(await screen.findByText(/Chegou: o sistema do cliente recebeu \(código 200\)/)).toBeInTheDocument();
    expect(screen.getByText('{"recebido":true}')).toBeInTheDocument();
  });

  it('teste recusado mostra o motivo', async () => {
    servico.testWebhook.mockResolvedValue({
      ok: false,
      response_code: 401,
      response_excerpt: 'assinatura inválida',
      duration_ms: 90,
      error: 'o sistema do cliente recusou o envio (401): confira se a chave secreta cadastrada lá é a atual',
    });
    const user = userEvent.setup();
    montar({ chaveGerada: true });

    await user.click(screen.getByRole('button', { name: /mandar um lead de teste/i }));

    expect(await screen.findByText(/Não chegou: o sistema do cliente recusou o envio \(401\)/)).toBeInTheDocument();
  });

  it('endereço sem https avisa na hora', () => {
    montar({ url: 'http://crm.exemplo.com.br' });

    expect(screen.getByText('O endereço precisa começar com https://')).toBeInTheDocument();
  });
});
