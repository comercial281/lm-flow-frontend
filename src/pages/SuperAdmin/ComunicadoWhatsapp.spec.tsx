// src/pages/SuperAdmin/ComunicadoWhatsapp.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const svc = vi.hoisted(() => ({ alvos: vi.fn(), enviar: vi.fn(), andamento: vi.fn() }));
vi.mock('@/services/superAdmin/comunicadoService', () => ({ comunicadoService: svc }));
const inst = vi.hoisted(() => ({ platformNumbers: vi.fn() }));
vi.mock('@/services/superAdmin/numberOwnershipService', () => ({ default: inst }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import ComunicadoWhatsapp from './ComunicadoWhatsapp';

const NUMERO = 'Operacional (LM01)';
const donos = {
  mode: 'owners', instance: NUMERO, running_id: null as string | null, unreadable: false,
  targets: [
    { tenant_id: 't1', name: 'Apto Premium', destination: '11988887777', reason: null },
    { tenant_id: 't2', name: 'Moeda Forte', destination: '11999990000', reason: null },
    { tenant_id: 't3', name: 'Sem Fone', destination: null, reason: 'Sem telefone' },
  ],
};
const grupos = {
  ...donos, mode: 'groups',
  targets: [
    { tenant_id: 't1', name: 'Apto Premium', destination: null, reason: 'Grupo não achado' },
    { tenant_id: 't2', name: 'Moeda Forte', destination: 'Moeda Forte x Leal Mídia', reason: null },
  ],
};
const andamento = (state: string, extra: Record<string, unknown> = {}) => ({
  id: 'c1', state, mode: 'owners', instance: NUMERO, message: 'Oi', by: 'Tony',
  started_at: '2026-10-06T10:00:00Z', finished_at: null, total: 2, sent: 1, failed: 0,
  items: [
    { tenant_id: 't1', name: 'Apto Premium', destination: '11988887777', status: 'sent', detail: null },
    { tenant_id: 't2', name: 'Moeda Forte', destination: '11999990000', status: 'queued', detail: null },
    { tenant_id: 't3', name: 'Sem Fone', destination: null, status: 'skipped', detail: 'Sem telefone' },
  ],
  ...extra,
});

const montar = () => render(<MemoryRouter><ComunicadoWhatsapp /></MemoryRouter>);
const escrever = (texto: string) => fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: texto } });

describe('Comunicação → WhatsApp (Comunicado)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.alvos.mockImplementation(async (modo: string) => (modo === 'groups' ? grupos : donos));
    svc.enviar.mockResolvedValue('c1');
    svc.andamento.mockResolvedValue(andamento('running'));
    inst.platformNumbers.mockResolvedValue({ data: { data: { unreadable: false, numbers: [
      { name: NUMERO, phone: null, status: 'connected' },
      { name: 'Sara', phone: null, status: 'never' },
    ] } } });
  });

  it('abre em Donos: quem tem telefone vem marcado; quem não tem fica de fora, com o motivo', async () => {
    montar();
    expect(await screen.findByText('(11) 98888-7777')).toBeInTheDocument();
    expect(screen.getByText('Sem telefone · fica de fora')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Apto Premium' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Sem Fone' })).toBeDisabled();
    expect(svc.alvos).toHaveBeenCalledWith('owners', undefined);
    expect(screen.getByLabelText('Número que envia')).toHaveValue(NUMERO);
  });

  it('enviar confirma com o N que sai de fato e só então manda, com a prévia do primeiro cliente', async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText('(11) 98888-7777');
    escrever('Olá, {nome}! Novidade no CRM.');
    expect(screen.getByText('Olá, Apto! Novidade no CRM.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('Mandar para 2 donos?');
    expect(svc.enviar).not.toHaveBeenCalled();
    await user.click(within(dialogo).getByRole('button', { name: 'Mandar' }));
    await waitFor(() => expect(svc.enviar).toHaveBeenCalledWith({
      mode: 'owners', instance: NUMERO, message: 'Olá, {nome}! Novidade no CRM.', tenant_ids: ['t1', 't2'], expected: 2,
    }));
  });

  it('desmarcar um cliente muda o N da confirmação', async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText('(11) 98888-7777');
    await user.click(screen.getByRole('checkbox', { name: 'Moeda Forte' }));
    escrever('Oi');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Mandar para 1 dono?');
  });

  it('Grupos lê o grupo de cada cliente pelo número que envia', async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText('(11) 98888-7777');
    await user.click(screen.getByRole('tab', { name: 'Grupos' }));
    expect(await screen.findByText('Moeda Forte x Leal Mídia')).toBeInTheDocument();
    expect(screen.getByText('Grupo não achado · fica de fora')).toBeInTheDocument();
    expect(svc.alvos).toHaveBeenLastCalledWith('groups', NUMERO);
  });

  it('número que não lê os grupos mostra erro, não uma lista de "Grupo não achado"', async () => {
    svc.alvos.mockImplementation(async (modo: string) => (modo === 'groups' ? { ...grupos, unreadable: true, targets: [] } : donos));
    const user = userEvent.setup();
    montar();
    await screen.findByText('(11) 98888-7777');
    await user.click(screen.getByRole('tab', { name: 'Grupos' }));
    expect(await screen.findByText('Não consegui ler os grupos')).toBeInTheDocument();
    expect(screen.queryByText(/fica de fora/)).not.toBeInTheDocument();
  });

  it('erro ao carregar não vira lista vazia: mostra o erro e tenta de novo', async () => {
    svc.alvos.mockRejectedValueOnce(new Error('rede'));
    const user = userEvent.setup();
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Não deu pra carregar');
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('(11) 98888-7777')).toBeInTheDocument();
  });

  it('depois de enviar, acompanha o andamento', async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText('(11) 98888-7777');
    escrever('Oi');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mandar' }));
    expect(await screen.findByText('Enviando 1 de 2…')).toBeInTheDocument();
    expect(svc.andamento).toHaveBeenCalledWith('c1');
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });

  it('ao abrir com um envio rodando, retoma; no fim mostra quem recebeu, quem falhou e quem ficou de fora', async () => {
    svc.alvos.mockImplementation(async () => ({ ...donos, running_id: 'c1' }));
    svc.andamento.mockResolvedValue(andamento('done', {
      failed: 1, finished_at: '2026-10-06T10:01:00Z',
      items: [
        { tenant_id: 't1', name: 'Apto Premium', destination: '11988887777', status: 'sent', detail: null },
        { tenant_id: 't2', name: 'Moeda Forte', destination: '11999990000', status: 'failed', detail: 'o WhatsApp respondeu 500' },
        { tenant_id: 't3', name: 'Sem Fone', destination: null, status: 'skipped', detail: 'Sem telefone' },
      ],
    }));
    montar();
    const envio = await screen.findByRole('region', { name: 'Envio' });
    expect(await within(envio).findByText('Terminou: 1 cliente recebeu · 1 falhou · 1 ficou de fora.')).toBeInTheDocument();
    expect(within(envio).getByText('Falhou: o WhatsApp respondeu 500')).toBeInTheDocument();
    expect(within(envio).getByText('Ficou de fora: Sem telefone')).toBeInTheDocument();
    expect(svc.andamento).toHaveBeenCalledWith('c1');
  });

  it('com outro envio rodando (409), avisa e passa a acompanhar o que está rodando', async () => {
    svc.enviar.mockRejectedValueOnce({
      response: { status: 409, data: { error: 'Já tem um comunicado sendo enviado. Espere ele terminar.', id: 'c9' } },
    });
    const user = userEvent.setup();
    montar();
    await screen.findByText('(11) 98888-7777');
    escrever('Oi');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mandar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Já tem um comunicado sendo enviado. Espere ele terminar.'));
    await waitFor(() => expect(svc.andamento).toHaveBeenCalledWith('c9'));
  });

  it('"A lista mudou": avisa e recarrega os destinos, sem seguir para o acompanhamento', async () => {
    svc.enviar.mockRejectedValueOnce({ response: { status: 422, data: { error: 'A lista mudou desde a confirmação. Confira e envie de novo.' } } });
    const user = userEvent.setup();
    montar();
    await screen.findByText('(11) 98888-7777');
    escrever('Oi');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mandar' }));
    await waitFor(() => expect(svc.alvos).toHaveBeenCalledTimes(2));
    expect(toast.error).toHaveBeenCalled();
    expect(svc.andamento).not.toHaveBeenCalled();
  });

  it('"Confirme o envio de novo": pede nova confirmação e reenvia com o mesmo N', async () => {
    svc.enviar.mockRejectedValueOnce({ response: { status: 422, data: { error: 'Confirme o envio de novo.' } } });
    const user = userEvent.setup();
    montar();
    await screen.findByText('(11) 98888-7777');
    escrever('Oi');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mandar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Confirme o envio de novo.'));
    const outra = await screen.findByRole('dialog');
    expect(outra).toHaveTextContent('Mandar para 2 donos?');
    expect(svc.enviar).toHaveBeenCalledTimes(1);
    await user.click(within(outra).getByRole('button', { name: 'Mandar' }));
    await waitFor(() => expect(svc.enviar).toHaveBeenCalledTimes(2));
    expect(svc.enviar.mock.calls[1][0].expected).toBe(2);
  });

  it('o seletor lista só os números da Leal Mídia, com a situação ao lado do nome', async () => {
    montar();
    await screen.findByText('(11) 98888-7777');
    const seletor = screen.getByLabelText('Número que envia');
    await waitFor(() => expect(within(seletor).getAllByRole('option')).toHaveLength(2));
    expect(within(seletor).getByRole('option', { name: `${NUMERO} · Conectado` })).toBeInTheDocument();
    expect(within(seletor).getByRole('option', { name: 'Sara · Nunca conectado' })).toBeInTheDocument();
    expect(seletor).toHaveValue(NUMERO);
  });

  it('número padrão que não é da Leal Mídia não fica escolhido: seletor sem valor e Enviar travado', async () => {
    svc.alvos.mockImplementation(async () => ({ ...donos, instance: 'Moeda Forte – Corretor X' }));
    montar();
    await screen.findByText('(11) 98888-7777');
    escrever('Oi');
    await waitFor(() => expect(screen.getByLabelText('Número que envia')).toHaveValue(''));
    expect(screen.queryByRole('option', { name: /Moeda Forte – Corretor X/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    expect(screen.getByText('Escolha o número que envia.')).toBeInTheDocument();
  });

  it('números ilegíveis: seletor vazio com erro e "Tentar de novo"; Enviar travado com o motivo', async () => {
    inst.platformNumbers.mockResolvedValueOnce({ data: { data: { unreadable: true, numbers: [] } } });
    const user = userEvent.setup();
    montar();
    await screen.findByText('(11) 98888-7777');
    escrever('Oi');
    expect(await screen.findByText('Não consegui ler os números da Leal Mídia')).toBeInTheDocument();
    expect(screen.queryByLabelText('Número que envia')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    expect(screen.getByText('Não consegui ler os números da Leal Mídia. Tente de novo.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.getByLabelText('Número que envia')).toHaveValue(NUMERO));
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled();
    expect(inst.platformNumbers).toHaveBeenCalledTimes(2);
  });

  it('falha ao ler os números também deixa o seletor vazio com erro', async () => {
    inst.platformNumbers.mockRejectedValueOnce(new Error('rede'));
    montar();
    expect(await screen.findByText('Não consegui ler os números da Leal Mídia')).toBeInTheDocument();
    expect(screen.queryByLabelText('Número que envia')).not.toBeInTheDocument();
  });

  it('servidor recusa o número (422): mostra o texto do servidor no envio', async () => {
    svc.enviar.mockRejectedValueOnce({ response: { status: 422, data: { error: 'Este número não é da Leal Mídia.' } } });
    const user = userEvent.setup();
    montar();
    await screen.findByText('(11) 98888-7777');
    escrever('Oi');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mandar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Este número não é da Leal Mídia.'));
  });

  it('servidor recusa o número ao carregar a lista (422): mostra o texto dele, não o erro genérico', async () => {
    svc.alvos.mockRejectedValueOnce({ response: { status: 422, data: { error: 'Não consegui conferir o número que envia.' } } });
    montar();
    expect(await screen.findByText('Não consegui conferir o número que envia.')).toBeInTheDocument();
  });

  it('sem número padrão (instance vazio): sem escolha e Enviar travado com o motivo', async () => {
    svc.alvos.mockImplementation(async () => ({ ...donos, instance: '' }));
    montar();
    expect(await screen.findByText('(11) 98888-7777')).toBeInTheDocument();
    escrever('Oi');
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    expect(screen.getByText('Escolha o número que envia.')).toBeInTheDocument();
  });

  it('envio interrompido mostra o que não dá pra saber e o que nem começou', async () => {
    svc.alvos.mockImplementation(async () => ({ ...donos, running_id: 'c1' }));
    svc.andamento.mockResolvedValue(andamento('interrupted', {
      sent: 0, failed: 2,
      items: [
        { tenant_id: 't1', name: 'Apto Premium', destination: '11988887777', status: 'failed', detail: 'não dá pra saber se saiu' },
        { tenant_id: 't2', name: 'Moeda Forte', destination: '11999990000', status: 'failed', detail: 'o envio parou antes deste cliente' },
      ],
    }));
    montar();
    const envio = await screen.findByRole('region', { name: 'Envio' });
    expect(await within(envio).findByText('Falhou: não dá pra saber se saiu')).toBeInTheDocument();
    expect(within(envio).getByText('Falhou: o envio parou antes deste cliente')).toBeInTheDocument();
  });

  it('item "sending" aparece como Enviando agora, durante o envio', async () => {
    svc.alvos.mockImplementation(async () => ({ ...donos, running_id: 'c1' }));
    svc.andamento.mockResolvedValue(andamento('running', {
      items: [{ tenant_id: 't1', name: 'Apto Premium', destination: '11988887777', status: 'sending', detail: null }],
    }));
    montar();
    const envio = await screen.findByRole('region', { name: 'Envio' });
    expect(await within(envio).findByText('Enviando agora')).toBeInTheDocument();
  });

  it('clique duplo em Mandar envia uma vez só', async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText('(11) 98888-7777');
    escrever('Oi');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    const mandar = within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mandar' });
    await user.dblClick(mandar);
    await waitFor(() => expect(svc.enviar).toHaveBeenCalled());
    expect(svc.enviar).toHaveBeenCalledTimes(1);
  });

  const clicarEnviarEMandar = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mandar' }));
  };

  it('cliente com motivo fica de fora mesmo com destino preenchido ("Mesmo destino de X")', async () => {
    svc.alvos.mockImplementation(async () => ({
      ...donos,
      targets: [
        ...donos.targets,
        { tenant_id: 't4', name: 'Duplicado', destination: '11988887777', reason: 'Mesmo destino de Apto Premium' },
      ],
    }));
    const user = userEvent.setup();
    montar();
    expect(await screen.findByText('Mesmo destino de Apto Premium · fica de fora')).toBeInTheDocument();
    const caixa = screen.getByRole('checkbox', { name: 'Duplicado' });
    expect(caixa).toBeDisabled();
    expect(caixa).not.toBeChecked();
    escrever('Oi');
    await clicarEnviarEMandar(user);
    await waitFor(() => expect(svc.enviar).toHaveBeenCalled());
    const envio = svc.enviar.mock.calls[0][0];
    expect(envio.tenant_ids).toEqual(['t1', 't2']);
    expect(envio.expected).toBe(2);
  });

  it('durante o envio, aba e número ficam travados; o recarregamento do 422 usa o modo e o número atuais', async () => {
    let falhar: (e: unknown) => void = () => {};
    svc.enviar.mockImplementationOnce(() => new Promise((_, rej) => { falhar = rej; }));
    const user = userEvent.setup();
    montar();
    await screen.findByText('(11) 98888-7777');
    escrever('Oi');
    await clicarEnviarEMandar(user);
    await waitFor(() => expect(svc.enviar).toHaveBeenCalled());
    expect(screen.getByLabelText('Número que envia')).toBeDisabled();
    fireEvent.click(screen.getByRole('tab', { name: 'Grupos' }));
    expect(svc.alvos).toHaveBeenCalledTimes(1);
    falhar({ response: { status: 422, data: { error: 'A lista mudou desde a confirmação.' } } });
    await waitFor(() => expect(svc.alvos).toHaveBeenCalledTimes(2));
    expect(svc.alvos).toHaveBeenLastCalledWith('owners', NUMERO);
  });

  it('depois de "A lista mudou": mantém a seleção, cliente novo entra desmarcado e a tela avisa', async () => {
    svc.enviar.mockRejectedValueOnce({ response: { status: 422, data: { error: 'A lista mudou desde a confirmação.' } } });
    const user = userEvent.setup();
    montar();
    await screen.findByText('(11) 98888-7777');
    await user.click(screen.getByRole('checkbox', { name: 'Moeda Forte' }));
    escrever('Oi');
    svc.alvos.mockImplementation(async () => ({
      ...donos,
      targets: [...donos.targets, { tenant_id: 't4', name: 'Novato', destination: '11977776666', reason: null }],
    }));
    await clicarEnviarEMandar(user);
    expect(await screen.findByText('1 cliente novo na lista ficou desmarcado.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Apto Premium' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Moeda Forte' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Novato' })).not.toBeChecked();
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('409 com o mesmo id que já está na tela força nova leitura do andamento', async () => {
    svc.alvos.mockImplementation(async () => ({ ...donos, running_id: 'c1' }));
    svc.andamento.mockResolvedValue(andamento('done', { finished_at: '2026-10-06T10:01:00Z' }));
    svc.enviar.mockRejectedValueOnce({ response: { status: 409, data: { error: 'Já tem um comunicado.', id: 'c1' } } });
    const user = userEvent.setup();
    montar();
    const envio = await screen.findByRole('region', { name: 'Envio' });
    await within(envio).findByRole('status');
    const antes = svc.andamento.mock.calls.length;
    escrever('Oi');
    await clicarEnviarEMandar(user);
    await waitFor(() => expect(svc.andamento.mock.calls.length).toBeGreaterThan(antes));
  });

  it('leitura do andamento que falha tenta de novo sozinha antes de pedir "Tentar de novo"', async () => {
    svc.alvos.mockImplementation(async () => ({ ...donos, running_id: 'c1' }));
    svc.andamento.mockRejectedValueOnce(new Error('rede')).mockResolvedValue(andamento('done'));
    montar();
    const envio = await screen.findByRole('region', { name: 'Envio' });
    expect(await within(envio).findByText(/Terminou/, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(svc.andamento).toHaveBeenCalledTimes(2);
  });

  it('andamento que sempre falha acaba em erro com "Tentar de novo"', async () => {
    svc.alvos.mockImplementation(async () => ({ ...donos, running_id: 'c1' }));
    svc.andamento.mockRejectedValue(new Error('rede'));
    montar();
    expect(await screen.findByText('Não consegui ler o andamento', {}, { timeout: 7000 })).toBeInTheDocument();
    expect(svc.andamento).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  }, 10000);

  it('andamento 404: diz que não achou o envio', async () => {
    svc.alvos.mockImplementation(async () => ({ ...donos, running_id: 'c1' }));
    svc.andamento.mockRejectedValue({ response: { status: 404, data: { error: 'não achei' } } });
    montar();
    expect(await screen.findByText('Não achei esse envio (pode ter passado de 24 h).')).toBeInTheDocument();
    expect(screen.queryByText(/continua no servidor/)).not.toBeInTheDocument();
  });

  it('lista com erro ou ilegível: Enviar trava com o motivo certo', async () => {
    svc.alvos.mockImplementation(async (modo: string) => (modo === 'groups' ? { ...grupos, unreadable: true, targets: [] } : donos));
    const user = userEvent.setup();
    montar();
    await screen.findByText('(11) 98888-7777');
    await user.click(screen.getByRole('tab', { name: 'Grupos' }));
    await screen.findByText('Não consegui ler os grupos');
    expect(screen.getByText('Escolha outro número ou tente de novo.')).toBeInTheDocument();
  });

  it('depois de aceito (202), a mensagem é limpa', async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText('(11) 98888-7777');
    escrever('Oi');
    await clicarEnviarEMandar(user);
    await waitFor(() => expect(screen.getByLabelText('Mensagem')).toHaveValue(''));
  });

  it('clique duplo em Enviar abre uma confirmação só e envia uma vez', async () => {
    montar();
    await screen.findByText('(11) 98888-7777');
    escrever('Oi');
    const botao = screen.getByRole('button', { name: 'Enviar' });
    fireEvent.click(botao);
    fireEvent.click(botao);
    expect(await screen.findAllByRole('dialog')).toHaveLength(1);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mandar' }));
    await waitFor(() => expect(svc.enviar).toHaveBeenCalled());
    expect(svc.enviar).toHaveBeenCalledTimes(1);
  });
});
