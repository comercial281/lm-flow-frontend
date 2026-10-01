import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const svc = vi.hoisted(() => ({
  getMemberAccessConfig: vi.fn(),
  centralInstances: vi.fn(),
  saveMemberAccessConfig: vi.fn(),
}));
vi.mock('@/services/clientInstances/clientInstancesService', () => ({ default: svc }));

import MensagemDeAcesso from './MensagemDeAcesso';

describe('Mensagem de acesso', () => {
  beforeEach(() => {
    svc.getMemberAccessConfig.mockResolvedValue({
      data: { data: { template: 'Olá {nome}! Entre: {link}', instance: 'LM01', enabled: true, default_template: 'padrão' } },
    });
    svc.centralInstances.mockResolvedValue({ data: { data: [{ name: 'LM01', connected: true }] } });
  });

  it('mostra a mensagem com a prévia preenchida', async () => {
    render(<MensagemDeAcesso />);
    expect(await screen.findByDisplayValue('Olá {nome}! Entre: {link}')).toBeInTheDocument();
    expect(screen.getByText(/Olá Bernardo! Entre: https:\/\//)).toBeInTheDocument();
  });

  it('não oferece mais a variável {senha} (a senha virou link na fase 1)', async () => {
    render(<MensagemDeAcesso />);
    await screen.findByDisplayValue('Olá {nome}! Entre: {link}');
    expect(screen.queryByText('{senha}')).not.toBeInTheDocument();
  });

  it('erro ao carregar aparece como erro, não como tela vazia', async () => {
    svc.getMemberAccessConfig.mockRejectedValue({ response: { data: { error: 'falhou' } } });
    render(<MensagemDeAcesso />);
    expect(await screen.findByText('falhou')).toBeInTheDocument();
  });

  it('erro ao carregar não deixa salvar por cima: só o erro e "Tentar de novo"', async () => {
    svc.getMemberAccessConfig.mockRejectedValueOnce({ response: { data: { error: 'falhou' } } });
    render(<MensagemDeAcesso />);
    expect(await screen.findByText('falhou')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /salvar/i })).toBeNull();
    const retry = screen.getByRole('button', { name: /tentar de novo/i });

    svc.getMemberAccessConfig.mockClear();
    fireEvent.click(retry);
    expect(await screen.findByDisplayValue('Olá {nome}! Entre: {link}')).toBeInTheDocument();
    expect(svc.getMemberAccessConfig).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('falhou')).toBeNull();
  });
});
