import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Visit } from '@/services/visits/visitsService';

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

const complete = vi.fn();
const feedback = vi.fn();
const cancel = vi.fn();
const confirm = vi.fn();
const noShow = vi.fn();
const get = vi.fn();
vi.mock('@/services/visits/visitsService', async (orig) => {
  const real = await orig<typeof import('@/services/visits/visitsService')>();
  return {
    ...real,
    visitsService: {
      ...real.visitsService,
      complete: (...a: unknown[]) => complete(...a),
      feedback: (...a: unknown[]) => feedback(...a),
      cancel: (...a: unknown[]) => cancel(...a),
      confirm: (...a: unknown[]) => confirm(...a),
      noShow: (...a: unknown[]) => noShow(...a),
      get: (...a: unknown[]) => get(...a),
    },
  };
});

vi.mock('@/hooks/useCan', () => ({ useCan: () => () => true }));

// A janela de agendar de verdade busca horários e corretores: aqui só importa
// com o que ela abriu.
// `criarNaJanela` simula a visita salva como a janela de verdade faz: chama
// `onCreated` e depois fecha (`onOpenChange(false)`). `fecharJanela` fecha sem
// criar. `desenhosDaJanela` conta quantas vezes a janela foi desenhada (aberta
// ou não): fechada, ela nem deve existir.
let criarNaJanela: (v: Visit) => void = () => {};
let fecharJanela: () => void = () => {};
let desenhosDaJanela = 0;
vi.mock('@/components/visits/ScheduleVisitDialog', () => ({
  ScheduleVisitDialog: (p: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    visitaParaRemarcar?: Visit | null;
    leadInicial?: { id: string; name: string } | null;
    imovelInicial?: { id: string } | null;
    onCreated?: (v: Visit) => void;
  }) => {
    desenhosDaJanela++;
    if (p.open) {
      criarNaJanela = v => { p.onCreated?.(v); p.onOpenChange(false); };
      fecharJanela = () => p.onOpenChange(false);
    }
    return p.open ? (
      <div
        data-testid="janela"
        data-lead={p.leadInicial?.id ?? ''}
        data-imovel={p.imovelInicial?.id ?? ''}
      >
        {p.visitaParaRemarcar ? 'Remarcar visita' : 'Nova visita'}
      </div>
    ) : null;
  },
}));

import { AcoesDaVisita } from './AcoesDaVisita';

const AGORA = new Date(2026, 9, 10, 11, 0);

const visita = (over: Partial<Visit> = {}): Visit => ({
  id: 'v1',
  property_id: 'p1',
  contact_id: 'c1',
  status: 'scheduled',
  scheduled_at: new Date(2026, 9, 11, 15, 0).toISOString(),
  property: { id: 'p1', title: 'Apto Centro', code: 'AP01' },
  contact: { id: 'c1', name: 'Maria Teste', phone_number: '5511999990000' },
  realtor: { id: 'u1', name: 'Ana Corretora' },
  created_at: '',
  updated_at: '',
  ...over,
});
const ONTEM = new Date(2026, 9, 9, 15, 0).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  desenhosDaJanela = 0;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(AGORA);
});
afterEach(() => vi.useRealTimers());

const nomes = () => screen.getAllByRole('button').map(b => b.textContent?.trim());

describe('AcoesDaVisita', () => {
  it('agendada amanhã: Remarcar, Cancelar e Confirmar, sem Realizada', () => {
    render(<AcoesDaVisita visita={visita()} onAtualizada={vi.fn()} />);
    expect(nomes()).toEqual(['Remarcar', 'Cancelar', 'Confirmar']);
    expect(screen.queryByRole('button', { name: 'Realizada' })).toBeNull();
  });

  it('agendada ontem: Não compareceu, Remarcar e Realizada em destaque', () => {
    render(<AcoesDaVisita visita={visita({ scheduled_at: ONTEM })} onAtualizada={vi.fn()} />);
    expect(nomes()).toEqual(['Não compareceu', 'Remarcar', 'Realizada']);
    expect(screen.getByRole('button', { name: 'Realizada' })).toHaveClass('w-full');
  });

  it('encerrada sem botão nenhum não desenha nada', () => {
    const { container } = render(
      <AcoesDaVisita visita={visita({ status: 'cancelled', cancelled_at: ONTEM })} onAtualizada={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('Realizada abre o retorno; 5 estrelas e Confirmar realização gravam', async () => {
    const user = userEvent.setup();
    const onAtualizada = vi.fn();
    const feita = visita({ scheduled_at: ONTEM, status: 'completed', rating: 5 });
    complete.mockResolvedValue(feita);
    render(<AcoesDaVisita visita={visita({ scheduled_at: ONTEM })} onAtualizada={onAtualizada} />);

    await user.click(screen.getByRole('button', { name: 'Realizada' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Marcar visita como realizada')).toBeInTheDocument();
    await user.click(within(dialogo).getByRole('button', { name: 'Avaliar com 5 estrelas' }));
    await user.click(within(dialogo).getByRole('button', { name: 'Confirmar realização' }));

    await waitFor(() => expect(onAtualizada).toHaveBeenCalledWith(feita));
    expect(complete).toHaveBeenCalledWith('v1', 5, undefined);
    expect(toastSuccess).toHaveBeenCalledWith('Visita marcada como realizada');
  });

  it('Dar retorno só salva com nota ou comentário', async () => {
    const user = userEvent.setup();
    const onAtualizada = vi.fn();
    const comRetorno = visita({ scheduled_at: ONTEM, status: 'completed', feedback_notes: 'Gostou' });
    feedback.mockResolvedValue(comRetorno);
    render(
      <AcoesDaVisita visita={visita({ scheduled_at: ONTEM, status: 'completed' })} onAtualizada={onAtualizada} />,
    );

    await user.click(screen.getByRole('button', { name: 'Dar retorno' }));
    const dialogo = await screen.findByRole('dialog');
    const salvar = within(dialogo).getByRole('button', { name: 'Salvar retorno' });
    expect(salvar).toBeDisabled();
    await user.type(within(dialogo).getByRole('textbox'), 'Gostou');
    await user.click(salvar);

    await waitFor(() => expect(onAtualizada).toHaveBeenCalledWith(comRetorno));
    expect(feedback).toHaveBeenCalledWith('v1', undefined, 'Gostou');
    expect(toastSuccess).toHaveBeenCalledWith('Retorno salvo');
  });

  it('Não compareceu pede confirmação, grava e oferece remarcar com o mesmo cliente', async () => {
    const user = userEvent.setup();
    const onAtualizada = vi.fn();
    const faltou = visita({ scheduled_at: ONTEM, status: 'no_show' });
    noShow.mockResolvedValue(faltou);
    // Como na tela de verdade: quem usa troca a visita pela salva. "Não
    // compareceu" fica sem botão nenhum, e a pergunta tem que continuar aberta.
    function ComEstado() {
      const [v, setV] = useState(visita({ scheduled_at: ONTEM }));
      return <AcoesDaVisita visita={v} onAtualizada={nova => { onAtualizada(nova); setV(nova); }} />;
    }
    render(<ComEstado />);

    await user.click(screen.getByRole('button', { name: 'Não compareceu' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('O cliente não veio à visita de 09/10 às 15:00?')).toBeInTheDocument();
    expect(noShow).not.toHaveBeenCalled();
    await user.click(within(dialogo).getByRole('button', { name: 'Não compareceu' }));

    await waitFor(() => expect(noShow).toHaveBeenCalledWith('v1'));
    expect(toastSuccess).toHaveBeenCalledWith('Marcado que o cliente não veio');

    const pergunta = await screen.findByRole('dialog');
    // Ainda não avisou: trocar a visita agora desmontaria a pergunta.
    expect(onAtualizada).not.toHaveBeenCalled();
    expect(within(pergunta).getByText('Remarcar agora?')).toBeInTheDocument();
    expect(
      within(pergunta).getByText('Abre uma visita nova para Maria Teste, com o mesmo imóvel e corretor.'),
    ).toBeInTheDocument();
    await user.click(within(pergunta).getByRole('button', { name: 'Remarcar' }));

    const janela = await screen.findByTestId('janela');
    expect(janela).toHaveTextContent('Nova visita');
    expect(janela).toHaveAttribute('data-lead', 'c1');
    expect(janela).toHaveAttribute('data-imovel', 'p1');
  });

  it('Agora não: só então avisa a visita com o cliente que não veio, uma vez', async () => {
    const user = userEvent.setup();
    const onAtualizada = vi.fn();
    const faltou = visita({ scheduled_at: ONTEM, status: 'no_show' });
    noShow.mockResolvedValue(faltou);
    render(<AcoesDaVisita visita={visita({ scheduled_at: ONTEM })} onAtualizada={onAtualizada} />);

    await user.click(screen.getByRole('button', { name: 'Não compareceu' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Não compareceu' }));
    const pergunta = await screen.findByText('Remarcar agora?');
    expect(onAtualizada).not.toHaveBeenCalled();
    await user.click(within(pergunta.closest('[role="dialog"]') as HTMLElement).getByRole('button', { name: 'Agora não' }));
    expect(onAtualizada).toHaveBeenCalledTimes(1);
    expect(onAtualizada).toHaveBeenCalledWith(faltou);
  });

  it('Remarcar agora: avisa a visita encerrada e depois a nova', async () => {
    const user = userEvent.setup();
    const onAtualizada = vi.fn();
    const faltou = visita({ scheduled_at: ONTEM, status: 'no_show' });
    noShow.mockResolvedValue(faltou);
    render(<AcoesDaVisita visita={visita({ scheduled_at: ONTEM })} onAtualizada={onAtualizada} />);

    await user.click(screen.getByRole('button', { name: 'Não compareceu' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Não compareceu' }));
    const pergunta = await screen.findByText('Remarcar agora?');
    await user.click(within(pergunta.closest('[role="dialog"]') as HTMLElement).getByRole('button', { name: 'Remarcar' }));
    await screen.findByTestId('janela');
    expect(onAtualizada).not.toHaveBeenCalled();

    const nova = visita({ id: 'v2', status: 'scheduled' });
    act(() => { criarNaJanela(nova); });
    expect(onAtualizada.mock.calls.map(c => c[0])).toEqual([faltou, nova]);
  });

  it('Remarcar agora e a janela fechada sem criar: avisa a visita encerrada uma vez só', async () => {
    const user = userEvent.setup();
    const onAtualizada = vi.fn();
    const faltou = visita({ scheduled_at: ONTEM, status: 'no_show' });
    noShow.mockResolvedValue(faltou);
    render(<AcoesDaVisita visita={visita({ scheduled_at: ONTEM })} onAtualizada={onAtualizada} />);

    await user.click(screen.getByRole('button', { name: 'Não compareceu' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Não compareceu' }));
    const pergunta = await screen.findByText('Remarcar agora?');
    await user.click(within(pergunta.closest('[role="dialog"]') as HTMLElement).getByRole('button', { name: 'Remarcar' }));
    await screen.findByTestId('janela');

    act(() => { fecharJanela(); });
    expect(onAtualizada).toHaveBeenCalledTimes(1);
    expect(onAtualizada).toHaveBeenCalledWith(faltou);
    expect(screen.queryByTestId('janela')).toBeNull();
  });

  it('a janela de agendar só existe quando abre (a Lista pode ter 200 visitas)', async () => {
    const user = userEvent.setup();
    render(<AcoesDaVisita visita={visita()} onAtualizada={vi.fn()} />);
    expect(desenhosDaJanela).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Remarcar' }));
    expect(await screen.findByTestId('janela')).toBeInTheDocument();
    act(() => { fecharJanela(); });
    expect(screen.queryByTestId('janela')).toBeNull();
  });

  it('Remarcar: a visita remarcada é avisada uma vez e a janela fecha', async () => {
    const user = userEvent.setup();
    const onAtualizada = vi.fn();
    render(<AcoesDaVisita visita={visita()} onAtualizada={onAtualizada} />);
    await user.click(screen.getByRole('button', { name: 'Remarcar' }));
    await screen.findByTestId('janela');

    const remarcada = visita({ status: 'rescheduled' });
    act(() => { criarNaJanela(remarcada); });
    expect(onAtualizada).toHaveBeenCalledTimes(1);
    expect(onAtualizada).toHaveBeenCalledWith(remarcada);
    expect(screen.queryByTestId('janela')).toBeNull();
  });

  describe('texto do "Remarcar agora?"', () => {
    const perguntar = async (v: Visit) => {
      const user = userEvent.setup();
      noShow.mockResolvedValue({ ...v, status: 'no_show' });
      render(<AcoesDaVisita visita={v} onAtualizada={vi.fn()} />);
      await user.click(screen.getByRole('button', { name: 'Não compareceu' }));
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Não compareceu' }));
      return (await screen.findByText('Remarcar agora?')).closest('[role="dialog"]') as HTMLElement;
    };

    it('sem imóvel: com o mesmo corretor', async () => {
      const pergunta = await perguntar(visita({ scheduled_at: ONTEM, property_id: null, property: undefined }));
      expect(within(pergunta).getByText('Abre uma visita nova para Maria Teste, com o mesmo corretor.')).toBeInTheDocument();
    });

    it('sem corretor: com o mesmo imóvel', async () => {
      const pergunta = await perguntar(visita({ scheduled_at: ONTEM, realtor: null }));
      expect(within(pergunta).getByText('Abre uma visita nova para Maria Teste, com o mesmo imóvel.')).toBeInTheDocument();
    });

    it('sem imóvel nem corretor: só a visita nova', async () => {
      const pergunta = await perguntar(visita({ scheduled_at: ONTEM, property_id: null, property: undefined, realtor: null }));
      expect(within(pergunta).getByText('Abre uma visita nova para Maria Teste.')).toBeInTheDocument();
    });
  });

  it('Remarcar abre a janela de remarcar a própria visita', async () => {
    const user = userEvent.setup();
    render(<AcoesDaVisita visita={visita()} onAtualizada={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Remarcar' }));
    expect(await screen.findByTestId('janela')).toHaveTextContent('Remarcar visita');
  });

  it('Cancelar pede motivo opcional e cancela', async () => {
    const user = userEvent.setup();
    const onAtualizada = vi.fn();
    const cancelada = visita({ status: 'cancelled' });
    cancel.mockResolvedValue(cancelada);
    render(<AcoesDaVisita visita={visita()} onAtualizada={onAtualizada} />);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Motivo do cancelamento')).toBeInTheDocument();
    await user.type(within(dialogo).getByRole('textbox'), '  viajou  ');
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar visita' }));

    await waitFor(() => expect(onAtualizada).toHaveBeenCalledWith(cancelada));
    expect(cancel).toHaveBeenCalledWith('v1', 'viajou');
    expect(toastSuccess).toHaveBeenCalledWith('Visita cancelada');
  });

  it('Confirmar grava direto, sem diálogo', async () => {
    const user = userEvent.setup();
    const onAtualizada = vi.fn();
    const confirmada = visita({ status: 'confirmed' });
    confirm.mockResolvedValue(confirmada);
    render(<AcoesDaVisita visita={visita()} onAtualizada={onAtualizada} />);

    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(onAtualizada).toHaveBeenCalledWith(confirmada));
    expect(confirm).toHaveBeenCalledWith('v1');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toastSuccess).toHaveBeenCalledWith('Visita confirmada');
  });

  it('erro 422 mostra a mensagem do servidor e traz a versão atual da visita', async () => {
    const user = userEvent.setup();
    const onAtualizada = vi.fn();
    const atual = visita({ status: 'cancelled', cancelled_at: ONTEM });
    cancel.mockRejectedValue({
      response: { status: 422, data: { error: { message: 'Essa visita já foi encerrada' } } },
    });
    get.mockResolvedValue(atual);
    render(<AcoesDaVisita visita={visita()} onAtualizada={onAtualizada} />);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar visita' }));

    await waitFor(() => expect(onAtualizada).toHaveBeenCalledWith(atual));
    expect(toastError).toHaveBeenCalledWith('Essa visita já foi encerrada');
    expect(get).toHaveBeenCalledWith('v1');
    expect(onAtualizada).toHaveBeenCalledTimes(1);
  });

  it('erro sem ser 422/404 não recarrega a visita', async () => {
    const user = userEvent.setup();
    const onAtualizada = vi.fn();
    confirm.mockRejectedValue({ response: { status: 500 } });
    render(<AcoesDaVisita visita={visita()} onAtualizada={onAtualizada} />);

    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Não deu para salvar'));
    expect(get).not.toHaveBeenCalled();
    expect(onAtualizada).not.toHaveBeenCalled();
  });

  it('trava o botão do diálogo enquanto salva', async () => {
    const user = userEvent.setup();
    let resolver: (v: Visit) => void = () => {};
    noShow.mockReturnValue(new Promise<Visit>(r => { resolver = r; }));
    render(<AcoesDaVisita visita={visita({ scheduled_at: ONTEM })} onAtualizada={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Não compareceu' }));
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('button', { name: 'Não compareceu' }));

    await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Salvando...' })).toBeDisabled());
    resolver(visita({ scheduled_at: ONTEM, status: 'no_show' }));
    expect(await screen.findByText('Remarcar agora?')).toBeInTheDocument();
  });
});
