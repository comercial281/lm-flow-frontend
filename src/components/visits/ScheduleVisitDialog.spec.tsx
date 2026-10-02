import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn() } }));

const leadPickerPage = vi.fn();
const leadPicker = vi.fn();
const list = vi.fn();
const create = vi.fn();
const realtors = vi.fn();
vi.mock('@/services/visits/visitsService', async (orig) => {
  const real = await orig<typeof import('@/services/visits/visitsService')>();
  return {
    ...real,
    visitsService: {
      ...real.visitsService,
      leadPickerPage: (...a: unknown[]) => leadPickerPage(...a),
      leadPicker: (...a: unknown[]) => leadPicker(...a),
      list: (...a: unknown[]) => list(...a),
      create: (...a: unknown[]) => create(...a),
      realtors: (...a: unknown[]) => realtors(...a),
    },
  };
});
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { list: vi.fn().mockResolvedValue({ data: [] }) } }));
// O servidor de hoje: agenda desligada, grade fixa (a agenda ligada está em
// ScheduleVisitDialog.agenda.spec.tsx).
vi.mock('@/services/visits/agendaService', () => ({
  agendaService: { getSettings: vi.fn().mockResolvedValue({ enabled: false }) },
}));

import { ScheduleVisitDialog } from './ScheduleVisitDialog';

const LEAD = { id: 'c1', name: 'Leonardo Teste', phone_number: '5511999990000', in_pipeline: true, stage_name: 'Em atendimento', owner: { id: 'u-bruno', name: 'Bruno' } };
const LEAD_SEM_DONO = { id: 'c2', name: 'Marcos Teste', phone_number: '5511999992222', in_pipeline: false, stage_name: null, owner: null };
const LEAD_DONO_FORA = { id: 'c3', name: 'Paula Teste', phone_number: null, in_pipeline: false, stage_name: null, owner: { id: 'u-saiu', name: 'Rafael' } };
const CORRETORES = [{ id: 'u-bruno', name: 'Bruno' }, { id: 'u-carla', name: 'Carla' }];

// Amanhã: a lista de horários começa às 07:00, sem depender da hora do teste.
const amanha = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); };

const abrir = () =>
  render(<ScheduleVisitDialog open onOpenChange={vi.fn()} diaInicial={amanha()} onCreated={vi.fn()} />);

// O mesmo endpoint serve as duas perguntas: a conferência do cargo ao abrir
// (`leadPickerPage('', 1, 1)`, só o meta interessa) e a lista paginada do campo
// de cliente (50 por vez).
let clientes: unknown[] = [LEAD];
const responderComo = (meta: { only_mine: boolean; me: { id: string; name: string } | null }) => {
  leadPickerPage.mockImplementation((_q: string, page: number, perPage: number) => {
    if (perPage === 1) return Promise.resolve({ data: [], meta });
    return Promise.resolve({ data: clientes, meta: { ...meta, total: clientes.length, page, per_page: perPage, has_more: false } });
  });
};
const comoCorretor = () => responderComo({ only_mine: true, me: { id: 'u-ana', name: 'Ana' } });
const comoGestor = () => responderComo({ only_mine: false, me: null });

const escolherCliente = async (nome: string) => {
  await userEvent.click(await screen.findByPlaceholderText('Buscar cliente por nome ou telefone'));
  await userEvent.click(await screen.findByText(nome));
};
const trocarCliente = async (nomeAtual: RegExp, novo: string) => {
  await userEvent.click(screen.getByDisplayValue(nomeAtual));
  await userEvent.click(await screen.findByText(novo));
};
const botaoCorretor = (nome: string) => screen.findByRole('button', { name: nome });

beforeEach(() => {
  vi.clearAllMocks();
  clientes = [LEAD];
  list.mockResolvedValue({ data: [], meta: { total: 0 } });
  realtors.mockResolvedValue(CORRETORES);
});

describe('Agendar visita', () => {
  it('corretor: o responsável é ele, sem botões de corretor', async () => {
    comoCorretor();
    realtors.mockResolvedValue([{ id: 'u-ana', name: 'Ana' }]);
    abrir();

    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Corretor responsável' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ana' })).not.toBeInTheDocument();
    expect(screen.queryByText('Criar contato novo')).not.toBeInTheDocument();
    expect(leadPickerPage).toHaveBeenCalledWith('', 1, 1);
  });

  it('enquanto confere o cargo, não mostra os botões e não deixa agendar', async () => {
    leadPickerPage.mockImplementation(() => new Promise(() => {}));
    realtors.mockImplementation(() => new Promise(() => {}));
    abrir();

    expect(screen.getByRole('button', { name: 'Agendar' })).toBeDisabled();
    expect(screen.queryByRole('group', { name: 'Corretor responsável' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bruno' })).not.toBeInTheDocument();
  });

  it('o modal é maior (64rem de largura máxima)', async () => {
    comoGestor();
    abrir();

    expect(await screen.findByRole('dialog')).toHaveStyle({ maxWidth: '64rem' });
  });

  it('gestor: vê os corretores em botões e escolher o cliente marca o dono do lead', async () => {
    comoGestor();
    abrir();

    const bruno = await botaoCorretor('Bruno');
    const carla = await botaoCorretor('Carla');
    expect(bruno).toHaveAttribute('aria-pressed', 'false');
    expect(carla).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByPlaceholderText('Buscar corretor por nome')).not.toBeInTheDocument();

    await escolherCliente('Leonardo Teste');

    expect(await botaoCorretor('Bruno')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Carla' })).toHaveAttribute('aria-pressed', 'false');
    expect(realtors).toHaveBeenCalledTimes(1);
  });

  it('horário ocupado aparece riscado e não pode ser escolhido', async () => {
    comoCorretor();
    const d = amanha();
    list.mockResolvedValue({
      data: [{ id: 'v1', scheduled_at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 15, 0).toISOString(), duration_minutes: 60, status: 'scheduled', contact: { name: 'Fulano Teste' } }],
      meta: { total: 1 },
    });
    abrir();

    const ocupado = await screen.findByRole('button', { name: /15:00 · ocupado, Fulano Teste/ });
    expect(ocupado).toBeDisabled();
    // O nome acessível carrega "ocupado, Fulano Teste" (aria-label), mas o
    // texto visível no botão é só a hora — o nome do cliente já aparece na
    // lista "Visitas ... nesse dia" logo abaixo, não precisa repetir aqui.
    expect(ocupado).toHaveTextContent('15:00');
    expect(ocupado.textContent).toBe('15:00');
    expect(screen.getByRole('button', { name: '16:00' })).toBeEnabled();
  });

  it('mostra o motivo que o servidor deu', async () => {
    comoCorretor();
    create.mockRejectedValue({ response: { data: { error: { message: 'Você já tem visita com Fulano Teste das 15h às 16h' } } } });
    abrir();

    await escolherCliente('Leonardo Teste');
    await userEvent.click(await screen.findByRole('button', { name: '10:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Agendar' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Você já tem visita com Fulano Teste das 15h às 16h'));
  });

  it('422 de conflito (alguém marcou nesse horário entre meio) recarrega a lista do dia', async () => {
    comoCorretor();
    create.mockRejectedValue({
      response: { status: 422, data: { error: { message: 'Esse horário acabou de ser ocupado' } } },
    });
    abrir();

    await escolherCliente('Leonardo Teste');

    // 1 chamada ao abrir (corretor travado já definido) + 1 ao trocar de cliente
    // não dispara de novo (mesmo corretor/dia) — só confere que já rodou antes do save.
    const chamadasAntes = list.mock.calls.length;
    expect(chamadasAntes).toBeGreaterThan(0);

    await userEvent.click(await screen.findByRole('button', { name: '10:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Agendar' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Esse horário acabou de ser ocupado'));
    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(chamadasAntes));
  });

  it('o resumo da visita fica num bloco próprio (embaixo de Imóvel no computador), com a data por extenso e as visitas do dia', async () => {
    comoCorretor();
    abrir();

    await escolherCliente('Leonardo Teste');
    await userEvent.click(await screen.findByRole('button', { name: '10:00' }));

    const resumo = await screen.findByRole('region', { name: 'Resumo da visita' });
    expect(within(resumo).getByText(/das 10h às 11h/)).toBeInTheDocument();
    expect(within(resumo).getByText('Nenhuma outra visita sua nesse dia.')).toBeInTheDocument();
    const quando = screen.getByRole('region', { name: 'Quando' });
    expect(within(quando).queryByText(/das 10h às 11h/)).not.toBeInTheDocument();
  });

  it('corretor não manda realtor_id; observações vão como realtor_notes', async () => {
    comoCorretor();
    create.mockResolvedValue({ id: 'v9' });
    abrir();

    await escolherCliente('Leonardo Teste');
    await userEvent.type(screen.getByPlaceholderText('Detalhes da visita'), 'Levar a chave');
    await userEvent.click(await screen.findByRole('button', { name: '10:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Agendar' }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    const payload = create.mock.calls[0][0];
    expect(payload.realtor_id).toBeUndefined();
    expect(payload.realtor_notes).toBe('Levar a chave');
    expect(payload.duration_minutes).toBe(60);
  });

  it('gestor: o payload manda o dono do lead como realtor_id', async () => {
    comoGestor();
    create.mockResolvedValue({ id: 'v10' });
    abrir();

    await escolherCliente('Leonardo Teste');
    expect(await botaoCorretor('Bruno')).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(await screen.findByRole('button', { name: '10:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Agendar' }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0].realtor_id).toBe('u-bruno');
  });

  it('gestor: o payload manda o corretor do botão escolhido', async () => {
    comoGestor();
    create.mockResolvedValue({ id: 'v11' });
    abrir();

    await escolherCliente('Leonardo Teste');
    await userEvent.click(await botaoCorretor('Carla'));
    expect(screen.getByRole('button', { name: 'Carla' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Bruno' })).toHaveAttribute('aria-pressed', 'false');
    expect(await screen.findByText('Nenhuma outra visita de Carla nesse dia.')).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: '10:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Agendar' }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0].realtor_id).toBe('u-carla');
  });

  it('gestor: trocar para um cliente sem dono desmarca o corretor e o salvar pede o corretor', async () => {
    comoGestor();
    clientes = [LEAD, LEAD_SEM_DONO];
    abrir();

    await escolherCliente('Leonardo Teste');
    expect(await botaoCorretor('Bruno')).toHaveAttribute('aria-pressed', 'true');

    await trocarCliente(/Leonardo Teste/, 'Marcos Teste');

    expect(screen.getByRole('button', { name: 'Bruno' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Carla' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(await screen.findByRole('button', { name: '10:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Agendar' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Escolha o corretor responsável'));
    expect(create).not.toHaveBeenCalled();
  });

  it('gestor: escolher outro corretor à mão e depois trocar para cliente sem dono desmarca de vez', async () => {
    comoGestor();
    clientes = [LEAD, LEAD_SEM_DONO];
    abrir();

    await escolherCliente('Leonardo Teste');
    await userEvent.click(await botaoCorretor('Carla'));
    expect(screen.getByRole('button', { name: 'Carla' })).toHaveAttribute('aria-pressed', 'true');

    await trocarCliente(/Leonardo Teste/, 'Marcos Teste');

    expect(screen.getByRole('button', { name: 'Carla' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Bruno' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('gestor: dono do lead fora da lista de corretores não fica marcado escondido', async () => {
    comoGestor();
    clientes = [LEAD_DONO_FORA];
    abrir();

    await escolherCliente('Paula Teste');
    await userEvent.click(await screen.findByRole('button', { name: '10:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Agendar' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Escolha o corretor responsável'));
    expect(create).not.toHaveBeenCalled();
    expect(screen.queryByText(/Visitas de Rafael/)).not.toBeInTheDocument();
  });

  it('gestor: se a lista de corretores não carrega, a tela avisa', async () => {
    comoGestor();
    realtors.mockRejectedValue(new Error('falhou'));
    abrir();

    expect(await screen.findByText('Não deu para carregar os corretores. Feche e abra de novo.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Corretor responsável' })).not.toBeInTheDocument();
  });

  it('corretor travado: sem outra visita mostra o texto na 1ª pessoa', async () => {
    comoCorretor();
    abrir();

    expect(await screen.findByText('Nenhuma outra visita sua nesse dia.')).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma outra visita de/)).not.toBeInTheDocument();
  });

  it('o cliente escolhido aparece pelo nome e telefone formatado, sem o número cru', async () => {
    comoGestor();
    abrir();

    await escolherCliente('Leonardo Teste');

    expect(screen.getByDisplayValue('Leonardo Teste · (11) 99999-0000')).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/5511999990000/)).not.toBeInTheDocument();
    expect(leadPickerPage).toHaveBeenCalledWith('', 1, 50);
  });
});

// O card do lead abre o modal da Agenda já com o cliente: o corretor não procura
// de novo quem ele está olhando, e a visita segue o horário e as folgas da Agenda
// (a janelinha antiga do card não seguia).
describe('Agendar visita · aberto pelo card do lead', () => {
  it('gestor: o cliente já vem escolhido e o dono dele marcado como corretor', async () => {
    comoGestor();
    render(
      <ScheduleVisitDialog open onOpenChange={vi.fn()} diaInicial={amanha()} leadInicial={LEAD} onCreated={vi.fn()} />,
    );

    expect(await screen.findByDisplayValue(/Leonardo Teste/)).toBeInTheDocument();
    expect(await botaoCorretor('Bruno')).toHaveAttribute('aria-pressed', 'true');
  });

  it('corretor: o cliente já vem escolhido e o corretor continua sendo ele', async () => {
    comoCorretor();
    realtors.mockResolvedValue([{ id: 'u-ana', name: 'Ana' }]);
    render(
      <ScheduleVisitDialog open onOpenChange={vi.fn()} diaInicial={amanha()} leadInicial={LEAD} onCreated={vi.fn()} />,
    );

    expect(await screen.findByDisplayValue(/Leonardo Teste/)).toBeInTheDocument();
    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bruno' })).not.toBeInTheDocument();
  });
});
