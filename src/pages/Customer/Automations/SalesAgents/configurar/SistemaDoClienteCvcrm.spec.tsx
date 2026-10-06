import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SistemaDoClienteCvcrm from './SistemaDoClienteCvcrm';

const servico = vi.hoisted(() => ({ cvcrmOptions: vi.fn(), testWebhook: vi.fn() }));
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: servico }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const conectado = (extra = {}) => ({
  connected: true, subdomain: 'habras', empreendimentos: [{ id: 48, nome: 'Jardins' }, { id: 50, nome: 'Bosque' }],
  filas: [{ id: 3, nome: 'Centro' }], errors: { empreendimentos: null, filas: null }, ...extra,
});

const montar = (props: Partial<Parameters<typeof SistemaDoClienteCvcrm>[0]> = {}) => {
  const aoMudar = vi.fn();
  render(
    <MemoryRouter>
      <SistemaDoClienteCvcrm agentId="ia-1" valor={{ empreendimento: null, fila: null }} aoMudar={aoMudar} podeTestar {...props} />
    </MemoryRouter>,
  );
  return aoMudar;
};

describe('Sistema do cliente → CVCRM', () => {
  beforeEach(() => vi.clearAllMocks());

  it('escolhe o empreendimento guardando o nome; "Deixar o CVCRM decidir" limpa', async () => {
    servico.cvcrmOptions.mockResolvedValue(conectado());
    const aoMudar = montar({ valor: { empreendimento: null, fila: { id: 3, nome: 'Centro' } } });

    await userEvent.selectOptions(await screen.findByLabelText('Empreendimento'), '50');
    expect(aoMudar).toHaveBeenLastCalledWith({ empreendimento: { id: 50, nome: 'Bosque' }, fila: { id: 3, nome: 'Centro' } });

    await userEvent.selectOptions(screen.getByLabelText('Fila de distribuição'), '');
    expect(aoMudar).toHaveBeenLastCalledWith({ empreendimento: null, fila: null });
  });

  it('escolha que sumiu da lista do CVCRM continua aparecendo', async () => {
    servico.cvcrmOptions.mockResolvedValue(conectado());
    montar({ valor: { empreendimento: { id: 99, nome: 'Antigo' }, fila: null } });

    expect(await screen.findByLabelText('Empreendimento')).toHaveValue('99');
    expect(screen.getByRole('option', { name: 'Antigo (não veio na lista do CVCRM)' })).toBeTruthy();
  });

  it('lista que falha mostra a frase e a outra segue', async () => {
    servico.cvcrmOptions.mockResolvedValue(conectado({ filas: [], errors: { empreendimentos: null, filas: 'O usuário do CVCRM não tem permissão para isso.' } }));
    montar();

    expect(await screen.findByText('O usuário do CVCRM não tem permissão para isso.')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Jardins' })).toBeTruthy();
  });

  it('teste: avisa que cria lead de verdade e mostra o resultado', async () => {
    servico.cvcrmOptions.mockResolvedValue(conectado());
    servico.testWebhook.mockResolvedValue({ ok: false, response_code: 401, response_excerpt: null, duration_ms: 800, error: 'O CVCRM recusou o e-mail ou o token.' });
    montar();

    expect(await screen.findByText(/cria um lead de verdade no CVCRM/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Mandar um lead de teste/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('Não chegou: O CVCRM recusou o e-mail ou o token.');
    expect(servico.testWebhook).toHaveBeenCalledWith('ia-1');
  });

  it('com o passo por salvar, o teste fica bloqueado', async () => {
    servico.cvcrmOptions.mockResolvedValue(conectado());
    montar({ podeTestar: false });

    expect(await screen.findByRole('button', { name: /Mandar um lead de teste/ })).toBeDisabled();
    expect(screen.getByText('Salve o passo antes de testar.')).toBeTruthy();
  });
});
