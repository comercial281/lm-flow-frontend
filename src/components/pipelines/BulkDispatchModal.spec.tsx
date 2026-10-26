import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import BulkDispatchModal from './BulkDispatchModal';

// Passos 1 a 4 da janela de disparo (16/10/2026): por onde sai, número de
// saída, quem fica de fora e o funil pronto.

const s = vi.hoisted(() => ({
  numeros: vi.fn(),
  previa: vi.fn(),
  canais: vi.fn(),
  funis: vi.fn(),
  funil: vi.fn(),
  criar: vi.fn(),
  testar: vi.fn(),
  navegar: vi.fn(),
  etapas: vi.fn(),
  automacoes: vi.fn(),
  leads: vi.fn(),
  fechar: vi.fn(),
  pode: vi.fn(),
}));
vi.mock('@/hooks/useCan', () => ({ useCan: () => s.pode }));
vi.mock('react-router-dom', async orig => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => s.navegar,
}));
vi.mock('@/services/broadcasts/broadcastsService', async orig => {
  const real = await orig<typeof import('@/services/broadcasts/broadcastsService')>();
  return {
    ...real,
    broadcastsService: {
      ...real.broadcastsService,
      senderOptions: s.numeros,
      audiencePreviewFull: s.previa,
      whatsappCloudOptions: s.canais,
      create: s.criar,
      testSendSequence: s.testar,
      automationOptions: s.automacoes,
      leadOptions: s.leads,
      uploadMedia: vi.fn(),
    },
  };
});
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { list: s.funis, get: s.funil },
}));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: { getPipelineStages: s.etapas },
}));
vi.mock('@/services/contacts/labelsService', () => ({
  labelsService: { getLabels: vi.fn().mockResolvedValue({ data: [] }) },
}));
vi.mock('@/services/messageFunnels/messageFunnelsService', () => ({
  tenantTemplateVariablesService: { list: vi.fn().mockResolvedValue({ builtin: [], custom: [] }) },
}));
// Se o "Usar funil" antigo aparecer em qualquer modo, o texto denuncia.
vi.mock('@/components/flowAutomations/ConversationFunnelSelect', () => ({
  ConversationFunnelSelect: () => <span>Usar funil</span>,
}));
vi.mock('@/components/messaging/MessageSequenceEditor', async orig => {
  const real = await orig<typeof import('@/components/messaging/MessageSequenceEditor')>();
  return {
    ...real,
    default: ({ onChange }: { onChange: (itens: unknown[]) => void }) => (
      <button onClick={() => onChange([{ ...real.newSequenceItem(), text_content: 'Oi {{nome}}' }])}>Preencher mensagem</button>
    ),
  };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

const numeros = {
  data: [
    { inbox_id: 'in1', name: 'Imobiliária', phone: '5511999990001', connection: 'open', owner_name: null, provider: 'evolution', sendable: true, reason: null },
    { inbox_id: 'in2', name: 'Corretor Ana', phone: '5511999990002', connection: 'open', owner_name: 'Ana', provider: 'evolution', sendable: true, reason: null },
    { inbox_id: 'in3', name: 'Corretor Beto', phone: '5511999990003', connection: 'disconnected', owner_name: 'Beto', provider: 'evolution', sendable: false, reason: 'disconnected' },
    { inbox_id: 'in4', name: 'Número Go', phone: '5511999990004', connection: 'open', owner_name: null, provider: 'evolution_go', sendable: false, reason: 'unsupported' },
  ],
  default_inbox_id: 'in2',
};
const previa = (
  count: number,
  excluded: Partial<Record<'opt_out' | 'frequency' | 'other_owner' | 'busy', number>> = {},
  eta: Partial<Record<'fast' | 'normal' | 'slow', string>> = {},
) => ({
  count,
  excluded: { opt_out: 0, frequency: 0, other_owner: 0, busy: 0, ...excluded },
  eta,
});
const funilPronto = {
  id: 'f1', name: 'Reativar base', is_enabled: true, archived_at: null, guide_done: true, team: false,
};
const funilDaEquipe = {
  id: 'f2', name: 'Lançamento', is_enabled: true, archived_at: null, guide_done: true, team: true,
};

// Automações do passo 2 (23/10/2026). Nomes de exemplo, sem dado de cliente.
const autoFixa = {
  id: 'a1', name: 'Boas-vindas da Clara', team: true, owner_name: null,
  number_mode: 'fixed', inbox_id: 'in9', inbox_name: 'IA Clara',
  first_step: { kind: 'send_whatsapp', text: 'Oi {{nome}}, aqui é a Clara', config: {} },
  more_blocks: 8, trigger_data: [],
};
const autoHerda = {
  id: 'a2', name: 'Reativação', team: false, owner_name: 'Ana',
  number_mode: 'inherit', inbox_id: null, inbox_name: null,
  first_step: { kind: 'wait', text: null, config: { mode: 'interval', minutes: 10 } },
  more_blocks: 40, trigger_data: ['formulario'],
};
const autoPorBloco = {
  id: 'a3', name: 'Antiga', team: true, owner_name: null,
  number_mode: 'per_block', inbox_id: null, inbox_name: null,
  first_step: { kind: 'send_whatsapp', text: 'Olá', config: {} },
  more_blocks: 2, trigger_data: [],
};
// Número próprio que não envia disparo: o servidor manda inbox_id/inbox_name nulos.
const autoNumeroQueNaoDispara = {
  id: 'a4', name: 'Boas-vindas do canal oficial', team: true, owner_name: null,
  number_mode: 'fixed', inbox_id: null, inbox_name: null,
  first_step: { kind: 'send_whatsapp', text: 'Oi', config: {} },
  more_blocks: 1, trigger_data: [],
};
const resumoDoFluxo = { passed: 12, passed_error: 3, running: 2, first_time: 140 };
// Com automação a prévia traz o resumo e, na de número próprio, o número imposto.
const previaComAutomacao = (_p: string, _a: unknown, _i?: string, fluxo?: { flow_automation_id?: string }) =>
  Promise.resolve(
    fluxo?.flow_automation_id
      ? {
          ...previa(300),
          flow: resumoDoFluxo,
          forced_inbox: fluxo.flow_automation_id === 'a1' ? { inbox_id: 'in9', name: 'IA Clara' } : null,
        }
      : previa(300),
  );

const abrir = () =>
  render(
    <MemoryRouter>
      <BulkDispatchModal open onOpenChange={() => {}} pipelineId="p1" pipelineName="Leads" stages={[]} />
    </MemoryRouter>,
  );

beforeEach(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
  s.numeros.mockReset().mockResolvedValue(numeros);
  s.previa.mockReset().mockResolvedValue(previa(300));
  s.canais.mockReset().mockResolvedValue([]);
  s.funis.mockReset().mockResolvedValue([funilPronto, funilDaEquipe]);
  s.funil.mockReset();
  s.criar.mockReset().mockResolvedValue({ id: 'b1' });
  s.testar.mockReset().mockResolvedValue(undefined);
  s.navegar.mockReset();
  s.etapas.mockReset().mockResolvedValue({ data: [] });
  s.automacoes.mockReset().mockResolvedValue([autoFixa, autoHerda, autoPorBloco]);
  s.leads.mockReset().mockResolvedValue({
    data: [
      { contact_id: 'c1', name: 'Pessoa Exemplo Um', phone: '5511900000001', stage_name: 'Novo lead', labels: [] },
      { contact_id: 'c2', name: 'Pessoa Exemplo Dois', phone: '5511900000002', stage_name: 'Novo lead', labels: [] },
      { contact_id: 'c3', name: 'Pessoa Exemplo Três', phone: '5511900000003', stage_name: 'Visita marcada', labels: [] },
    ],
    meta: { total: 3, page: 1, per_page: 20 },
  });
  s.fechar.mockReset();
  s.pode.mockReset().mockReturnValue(true);
});

describe('BulkDispatchModal · passo 1 (por onde sai e quem recebe)', () => {
  it('abre com "Campanha direta" marcada e o número padrão escolhido', async () => {
    abrir();
    expect(await screen.findByRole('group', { name: 'Por onde sai' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Campanha direta' })).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(screen.getByLabelText('Número de saída')).toHaveValue('in2'));
  });

  it('número desconectado e conexão que não dispara aparecem desabilitados com o motivo', async () => {
    abrir();
    await waitFor(() => expect(screen.getByLabelText('Número de saída')).toHaveValue('in2'));
    expect(screen.getByRole('option', { name: /Corretor Beto.*\(desconectado\)/ })).toBeDisabled();
    expect(screen.getByRole('option', { name: /Número Go.*\(este tipo de conexão ainda não faz disparo\)/ })).toBeDisabled();
    expect(screen.getByRole('option', { name: /Corretor Ana/ })).not.toBeDisabled();
  });

  it('sem número oficial: "WhatsApp oficial" fica desabilitado e diz onde conectar', async () => {
    abrir();
    const oficial = await screen.findByRole('radio', { name: 'WhatsApp oficial (modelo aprovado)' });
    await waitFor(() => expect(s.canais).toHaveBeenCalled());
    expect(oficial).toHaveAttribute('aria-disabled', 'true');
    expect(await screen.findByText('Conecte um número oficial em Integrações')).toBeInTheDocument();
  });

  it('conta os leads e diz quem ficou de fora, só as partes que não são zero', async () => {
    s.previa.mockResolvedValue(previa(300, { other_owner: 40, busy: 0, opt_out: 2, frequency: 0 }));
    abrir();
    expect(await screen.findByText('300 leads')).toBeInTheDocument();
    expect(screen.getByText('42 ficaram de fora: 2 pediram pra parar, 40 são de outros corretores')).toBeInTheDocument();
  });

  it('no singular e sem linha quando ninguém fica de fora', async () => {
    s.previa.mockResolvedValueOnce(previa(1, { busy: 1 }));
    abrir();
    expect(await screen.findByText('1 lead')).toBeInTheDocument();
    expect(screen.getByText('1 ficou de fora: 1 já está em outra régua')).toBeInTheDocument();
  });

  it('sem ninguém de fora, não aparece a linha', async () => {
    abrir();
    expect(await screen.findByText('300 leads')).toBeInTheDocument();
    expect(screen.queryByText(/ficou de fora|ficaram de fora/)).toBeNull();
  });

  it('trocar o número conta de novo com o número novo', async () => {
    abrir();
    await waitFor(() => expect(s.previa).toHaveBeenLastCalledWith('p1', expect.objectContaining({ mode: 'pipeline' }), 'in2'));
    await userEvent.selectOptions(screen.getByLabelText('Número de saída'), 'in1');
    await waitFor(() => expect(s.previa).toHaveBeenLastCalledWith('p1', expect.objectContaining({ mode: 'pipeline' }), 'in1'));
  });

  it('números que falham ao carregar mostram o erro e Tentar de novo recupera', async () => {
    s.numeros.mockRejectedValueOnce(new Error('rede'));
    abrir();
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.getByLabelText('Número de saída')).toHaveValue('in2'));
  });
});

describe('BulkDispatchModal · passo 2 (o que mandar)', () => {
  const irProPasso2 = async () => {
    abrir();
    await screen.findByText('300 leads');
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    return screen.findByRole('group', { name: 'O que mandar' });
  };

  it('abre em "Mensagem" sem o "Usar funil" antigo', async () => {
    await irProPasso2();
    expect(screen.getByRole('radio', { name: 'Mensagem' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('Usar funil')).toBeNull();
  });

  it('"Funil pronto" + escolher um funil mostra a prévia e habilita o Próximo', async () => {
    s.funil.mockResolvedValue({
      ...funilPronto,
      initial_node_id: 'n1',
      nodes: [{ id: 'n1', kind: 'send_whatsapp', config: { text: 'Oi {{nome}}, tudo bem?' }, next_node_id: null, next_yes_node_id: null }],
    });
    await irProPasso2();
    await userEvent.click(screen.getByRole('radio', { name: 'Funil pronto' }));
    const campo = await screen.findByLabelText('Funil');
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeDisabled();
    expect(within(campo).getByRole('group', { name: 'Meus funis' })).toBeInTheDocument();
    expect(within(campo).getByRole('group', { name: 'Da equipe' })).toBeInTheDocument();
    await userEvent.selectOptions(campo, 'f1');
    expect(await screen.findByText('Oi {{nome}}, tudo bem?')).toBeInTheDocument();
    expect(s.funil).toHaveBeenCalledWith('f1');
    expect(s.funis).toHaveBeenCalledWith({ kind: 'conversation' });
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeEnabled();
    expect(screen.queryByText('Usar funil')).toBeNull();
  });

  it('sem funil pronto: aviso com "Montar funil"', async () => {
    s.funis.mockResolvedValue([{ ...funilPronto, is_enabled: false }]);
    await irProPasso2();
    await userEvent.click(screen.getByRole('radio', { name: 'Funil pronto' }));
    expect(await screen.findByRole('button', { name: 'Montar funil' })).toBeInTheDocument();
  });

  it('funis que falham ao carregar mostram o erro e Tentar de novo recupera', async () => {
    s.funis.mockRejectedValueOnce(new Error('rede'));
    await irProPasso2();
    await userEvent.click(screen.getByRole('radio', { name: 'Funil pronto' }));
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByLabelText('Funil')).toBeInTheDocument();
  });

  it('o disparo com funil vai com o número e o funil, sem a sequência', async () => {
    s.funil.mockResolvedValue({ ...funilPronto, initial_node_id: null, nodes: [] });
    await irProPasso2();
    await userEvent.click(screen.getByRole('radio', { name: 'Funil pronto' }));
    await userEvent.selectOptions(await screen.findByLabelText('Funil'), 'f1');
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: /Disparar pra 300/ }));
    await waitFor(() => expect(s.criar).toHaveBeenCalled());
    const payload = s.criar.mock.calls[0][0];
    expect(payload).toMatchObject({ channel_kind: 'evolution', inbox_id: 'in2', flow_automation_id: 'f1' });
    expect(payload.funnel_items).toBeUndefined();
  });
});


// Terça-feira 20/10/2026, 10h em São Paulo.
const TERCA_10H = new Date('2026-10-20T13:00:00Z');
const ETA = {
  fast: '2026-10-20T20:00:00Z',
  normal: '2026-10-21T18:00:00Z',
  slow: '2026-10-22T18:00:00Z',
};

describe('BulkDispatchModal · passo 3 (ritmo) e 4 (revisar)', () => {
  afterEach(() => vi.useRealTimers());

  const plural = (n: number, a: string, b: string) => `${n} ${n === 1 ? a : b}`;
  // Chega no passo Ritmo pelo funil pronto (não precisa montar mensagem).
  const irProRitmo = async (contagem = 300) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TERCA_10H);
    s.previa.mockResolvedValue(previa(contagem, {}, ETA));
    s.funil.mockResolvedValue({ ...funilPronto, initial_node_id: null, nodes: [] });
    abrir();
    await screen.findByText(plural(contagem, 'lead', 'leads'));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('radio', { name: 'Funil pronto' }));
    await userEvent.selectOptions(await screen.findByLabelText('Funil'), 'f1');
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
  };

  it('abre com Normal escolhido e diz quando termina', async () => {
    await irProRitmo(300);
    expect(await screen.findByRole('radio', { name: 'Normal' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Rápido' })).toHaveAccessibleDescription('30 a 50 segundos entre mensagens, pausa de 5 min a cada 10');
    expect(screen.getByRole('radio', { name: 'Devagar' })).toHaveAccessibleDescription('2 a 4 minutos entre mensagens, pausa de 20 min a cada 10');
    expect(screen.getByText('300 leads no ritmo Normal: termina amanhã por volta das 15h')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Rápido' }));
    expect(screen.getByText('300 leads no ritmo Rápido: termina hoje por volta das 17h')).toBeInTheDocument();
  });

  it('sem previsão do servidor, mostra só o ritmo e não quebra', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    s.previa.mockResolvedValue(previa(5));
    abrir();
    await screen.findByText('5 leads');
    s.funil.mockResolvedValue({ ...funilPronto, initial_node_id: null, nodes: [] });
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('radio', { name: 'Funil pronto' }));
    await userEvent.selectOptions(await screen.findByLabelText('Funil'), 'f1');
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(await screen.findByText('5 leads no ritmo Normal.')).toBeInTheDocument();
  });

  it('não tem mais intervalo, lote, pausa nem limites na tela', async () => {
    await irProRitmo(300);
    await screen.findByRole('radio', { name: 'Normal' });
    expect(screen.queryByLabelText(/Intervalo mínimo/)).toBeNull();
    expect(screen.queryByLabelText(/Não reenviar nos últimos/)).toBeNull();
    expect(screen.queryByText('Limites')).toBeNull();
  });

  it('lista com mais de 100 leads avisa; com 100 não', async () => {
    await irProRitmo(101);
    expect(await screen.findByText('Quanto maior a lista, mais devagar: o risco de bloqueio do número é menor.')).toBeInTheDocument();
  });

  it('com 100 leads o aviso de lista grande não aparece', async () => {
    await irProRitmo(100);
    await screen.findByRole('radio', { name: 'Normal' });
    expect(screen.queryByText(/Quanto maior a lista/)).toBeNull();
  });

  it('criar no modo funil manda pace normal, o funil e o número, sem sequência nem os campos antigos', async () => {
    await irProRitmo(300);
    await userEvent.click(await screen.findByRole('button', { name: 'Próximo' }));
    expect(await screen.findByText('Campanha direta · Corretor Ana (11) 99999-0002')).toBeInTheDocument();
    expect(screen.getByText('Normal · termina amanhã por volta das 15h')).toBeInTheDocument();
    expect(screen.queryByText('Enviar teste pra um número')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Disparar pra 300/ }));
    await waitFor(() => expect(s.criar).toHaveBeenCalled());
    const payload = s.criar.mock.calls[0][0];
    expect(payload).toMatchObject({ pace: 'normal', flow_automation_id: 'f1', inbox_id: 'in2', channel_kind: 'evolution' });
    for (const campo of ['funnel_items', 'min_interval_seconds', 'max_interval_seconds', 'batch_size', 'batch_pause_seconds', 'business_hours_only', 'respect_opt_out', 'frequency_cap_days']) {
      expect(payload).not.toHaveProperty(campo, expect.anything());
    }
  });

  it('depois de criar, Acompanhar leva pra /disparos/<id> e fecha a janela', async () => {
    const fechar = vi.fn();
    vi.useFakeTimers({ toFake: ['Date'] });
    s.previa.mockResolvedValue(previa(300, {}, ETA));
    s.funil.mockResolvedValue({ ...funilPronto, initial_node_id: null, nodes: [] });
    render(
      <MemoryRouter>
        <BulkDispatchModal open onOpenChange={fechar} pipelineId="p1" pipelineName="Leads" stages={[]} />
      </MemoryRouter>,
    );
    await screen.findByText('300 leads');
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('radio', { name: 'Funil pronto' }));
    await userEvent.selectOptions(await screen.findByLabelText('Funil'), 'f1');
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: /Disparar pra 300/ }));
    expect(await screen.findByText('Disparo criado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Acompanhar' }));
    expect(s.navegar).toHaveBeenCalledWith('/disparos/b1');
    expect(fechar).toHaveBeenCalledWith(false);
  });

  it('o teste da sequência sai do número escolhido', async () => {
    s.previa.mockResolvedValue(previa(300, {}, ETA));
    abrir();
    await screen.findByText('300 leads');
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Preencher mensagem' }));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Próximo' }));
    await userEvent.type(await screen.findByPlaceholderText('(11) 99999-9999'), '11988887777');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar teste' }));
    await waitFor(() => expect(s.testar).toHaveBeenCalled());
    expect(s.testar.mock.calls[0][2]).toBe('in2');
  });
});

describe('BulkDispatchModal · campanha direta (mensagem) e ritmo', () => {
  const irProRevisarComMensagem = async () => {
    abrir();
    await screen.findByText('300 leads');
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Preencher mensagem' }));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await screen.findByRole('radio', { name: 'Normal' });
  };

  it('criar em "Mensagem" manda a sequência e o número, sem funil', async () => {
    await irProRevisarComMensagem();
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: /Disparar pra 300/ }));
    await waitFor(() => expect(s.criar).toHaveBeenCalled());
    const payload = s.criar.mock.calls[0][0];
    expect(payload).toMatchObject({ channel_kind: 'evolution', inbox_id: 'in2', pace: 'normal' });
    expect(payload.funnel_items).toEqual([expect.objectContaining({ kind: 'text', text_content: 'Oi {{nome}}' })]);
    expect(payload.flow_automation_id).toBeUndefined();
    expect(payload.max_spend).toBeUndefined();
  });

  it('escolher "Rápido" manda pace fast', async () => {
    await irProRevisarComMensagem();
    await userEvent.click(screen.getByRole('radio', { name: 'Rápido' }));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: /Disparar pra 300/ }));
    await waitFor(() => expect(s.criar).toHaveBeenCalled());
    expect(s.criar.mock.calls[0][0]).toMatchObject({ pace: 'fast' });
  });
});

describe('BulkDispatchModal · espera as cargas', () => {
  it('enquanto recontamos o público, o Próximo espera', async () => {
    abrir();
    await screen.findByText('300 leads');
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeEnabled();
    s.previa.mockReturnValue(new Promise(() => {}));
    await userEvent.selectOptions(screen.getByLabelText('Número de saída'), 'in1');
    expect(await screen.findByText('Contando destinatários...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeDisabled();
  });

  it('enquanto os números oficiais carregam, não diz que a conta não tem', async () => {
    s.canais.mockReturnValue(new Promise(() => {}));
    abrir();
    const oficial = await screen.findByRole('radio', { name: 'WhatsApp oficial (modelo aprovado)' });
    expect(oficial).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getAllByText('Carregando números oficiais…').length).toBeGreaterThan(0);
    expect(screen.queryByText('Conecte um número oficial em Integrações')).toBeNull();
  });
});

describe('BulkDispatchModal · disparo oficial', () => {
  // Chega no passo "O que mandar" do oficial, com o modelo escolhido.
  const irProModeloOficial = async () => {
    s.canais.mockResolvedValue([
      {
        inbox_id: 'of1', name: 'Oficial 1', phone_number: '5511999990000',
        templates: [{ name: 'oferta', language: 'pt_BR', category: 'marketing', status: 'APPROVED', approved: true, variables: [], variable_count: 0, content: 'Oi!' }],
      },
    ]);
    abrir();
    await screen.findByText('300 leads');
    const oficial = screen.getByRole('radio', { name: 'WhatsApp oficial (modelo aprovado)' });
    await waitFor(() => expect(oficial).not.toHaveAttribute('aria-disabled'));
    await userEvent.click(oficial);
    await userEvent.click(await screen.findByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('combobox', { name: 'Modelo' }));
    await userEvent.click(await screen.findByRole('option', { name: /oferta/ }));
  };
  const criarComTeto = async (teto: string) => {
    await irProModeloOficial();
    if (teto) await userEvent.type(screen.getByLabelText('Teto de gasto (R$)'), teto);
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Próximo' }));
  };
  const disparar = async () => {
    await userEvent.click(await screen.findByRole('button', { name: /Disparar pra 300/ }));
    await waitFor(() => expect(s.criar).toHaveBeenCalled());
    return s.criar.mock.calls[0][0];
  };

  it('cria pelo modelo aprovado com o teto de gasto, o ritmo normal e sem número de saída', async () => {
    await criarComTeto('12,5');
    const payload = await disparar();
    expect(payload).toMatchObject({ channel_kind: 'whatsapp_cloud', pace: 'normal', max_spend: 12.5 });
    expect(payload.template_config).toMatchObject({ template_name: 'oferta' });
    expect(payload.inbox_id).toBeUndefined();
  });

  it('teto no jeito brasileiro: "1.000,00" vira 1000 e o resumo mostra o teto', async () => {
    await criarComTeto('1.000,00');
    expect(await screen.findByText('Teto de gasto')).toBeInTheDocument();
    expect(screen.getByText(/^R\$\s1\.000,00$/)).toBeInTheDocument();
    expect(await disparar()).toMatchObject({ max_spend: 1000 });
  });

  it('"1.000" é mil reais, não um real', async () => {
    await criarComTeto('R$ 1.000');
    expect(await disparar()).toMatchObject({ max_spend: 1000 });
  });

  it('teto que não é valor mostra o erro embaixo do campo e não deixa avançar', async () => {
    await irProModeloOficial();
    await userEvent.type(screen.getByLabelText('Teto de gasto (R$)'), '12abc');
    expect(screen.getByRole('alert')).toHaveTextContent('Digite o valor em reais, como 150 ou 1.000,00.');
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Teto de gasto (R$)'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeEnabled();
  });

  it('sem teto, o resumo diz "Sem teto" e o disparo vai sem limite de gasto', async () => {
    await criarComTeto('');
    expect(await screen.findByText('Sem teto')).toBeInTheDocument();
    const payload = await disparar();
    expect(payload.max_spend).toBeUndefined();
  });
});

describe('BulkDispatchModal · seletor de funil (página Disparos)', () => {
  const funis = [{ id: 'p1', name: 'Vendas' }, { id: 'p2', name: 'Locação' }] as never[];
  const abrirComFunis = () =>
    render(
      <MemoryRouter>
        <BulkDispatchModal open onOpenChange={() => {}} pipelineId="p1" stages={[]} funis={funis} />
      </MemoryRouter>,
    );

  it('sem a lista de funis não mostra o seletor "Funil"', async () => {
    abrir();
    await screen.findByLabelText('Número de saída');
    expect(screen.queryByLabelText('Funil')).toBeNull();
  });

  it('com funis mostra o seletor, e trocar recarrega as etapas e a contagem', async () => {
    abrirComFunis();
    const seletor = await screen.findByLabelText('Funil');
    expect(seletor).toHaveValue('p1');
    await waitFor(() => expect(s.etapas).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(s.previa).toHaveBeenCalledWith('p1', expect.anything(), expect.anything()));
    await userEvent.selectOptions(seletor, 'p2');
    await waitFor(() => expect(s.etapas).toHaveBeenLastCalledWith('p2'));
    await waitFor(() => expect(s.previa).toHaveBeenLastCalledWith('p2', expect.anything(), expect.anything()));
  });

  it('duas cargas de etapas fora de ordem deixam as etapas do funil mais novo', async () => {
    abrirComFunis();
    const seletor = await screen.findByLabelText('Funil');
    await waitFor(() => expect(s.etapas).toHaveBeenCalledWith('p1'));
    const adiado: Record<string, (v: unknown) => void> = {};
    s.etapas.mockImplementation((id: string) => new Promise(r => { adiado[id] = r; }));
    await userEvent.selectOptions(seletor, 'p2');
    await userEvent.selectOptions(seletor, 'p1');
    // a do p1 (mais nova) chega antes; a do p2 (velha) chega depois
    adiado['p1']({ data: [{ id: 'sp1', name: 'Etapa do Vendas' }] });
    adiado['p2']({ data: [{ id: 'sp2', name: 'Etapa da Locação' }] });
    await userEvent.click(await screen.findByRole('combobox', { name: /Enviar para/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Uma etapa específica' }));
    await userEvent.click(await screen.findByRole('combobox', { name: /Etapa/ }));
    expect(await screen.findByRole('option', { name: 'Etapa do Vendas' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Etapa da Locação' })).toBeNull();
  });
});

describe('BulkDispatchModal · passo 2, Automação', () => {
  const irProAutomacao = async () => {
    s.previa.mockImplementation(previaComAutomacao);
    abrir();
    await screen.findByText('300 leads');
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('radio', { name: 'Automação' }));
    return screen.findByLabelText('Automação');
  };
  const escolher = async (id: string) => {
    const campo = await irProAutomacao();
    await userEvent.selectOptions(campo, id);
  };
  const ateDisparar = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: /Disparar pra 300/ }));
    await waitFor(() => expect(s.criar).toHaveBeenCalled());
    return s.criar.mock.calls[0][0];
  };

  it('sem escolher a automação o Próximo fica travado', async () => {
    await irProAutomacao();
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeDisabled();
  });

  it('automação com número próprio diz por qual número sai e reconta com ela', async () => {
    await escolher('a1');
    expect(
      await screen.findByText('Sai pelo número da automação: IA Clara. O número escolhido no passo 1 não vale pra ela.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(s.previa).toHaveBeenLastCalledWith('p1', expect.objectContaining({ mode: 'pipeline' }), 'in2', {
        flow_automation_id: 'a1',
        include_passed: true,
        restart_running: false,
      }),
    );
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeEnabled();
  });

  it('automação sem número próprio não mostra a linha do número', async () => {
    await escolher('a2');
    await screen.findByText(/e mais 40 blocos/);
    expect(screen.queryByText(/Sai pelo número da automação/)).toBeNull();
  });

  it('automação de número por bloco aparece desabilitada com o motivo', async () => {
    await irProAutomacao();
    expect(
      screen.getByRole('option', { name: /Antiga.*Escolha o número nas Configurações da automação pra poder disparar\./ }),
    ).toBeDisabled();
  });

  it('automação com número próprio que não envia disparo aparece desabilitada e não libera o Próximo', async () => {
    s.automacoes.mockResolvedValue([autoFixa, autoNumeroQueNaoDispara]);
    const campo = await irProAutomacao();
    const opcao = screen.getByRole('option', {
      name: 'Boas-vindas do canal oficial · O número da automação não envia disparo. Troque nas Configurações da automação.',
    });
    expect(opcao).toBeDisabled();
    // Mesmo que chegue escolhida (lista do celular, valor antigo), o Próximo não libera.
    await userEvent.selectOptions(campo, 'a4').catch(() => {});
    expect(screen.queryByText(/Sai pelo número da automação/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeDisabled();
    expect(screen.getAllByRole('option', { name: /Escolha o número nas Configurações|não envia disparo/ })).toHaveLength(1);
  });

  it('a prévia é uma linha só, cortada, mesmo com 40 blocos, e "e mais 40 blocos" abre a automação em aba nova', async () => {
    await escolher('a2');
    const previaDaAutomacao = await screen.findByTestId('previa-da-automacao');
    expect(previaDaAutomacao).toHaveTextContent('Começa com: Esperar 10 minutos · e mais 40 blocos');
    expect(previaDaAutomacao.className).toContain('h-9');
    expect(within(previaDaAutomacao).getByText('Começa com: Esperar 10 minutos').className).toContain('truncate');
    const link = within(previaDaAutomacao).getByRole('link', { name: 'e mais 40 blocos (abre em nova aba)' });
    expect(link).toHaveAttribute('href', '/automations/flow-builder/a2');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('dado que só o gatilho traz vira aviso e o Próximo continua liberado', async () => {
    await escolher('a2');
    expect(
      await screen.findByText('Essa automação usa dados de formulário. No disparo eles vêm vazios.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeEnabled();
  });

  it('o resumo "Quem recebe" mostra as linhas com as caixinhas dentro, sem botão solto', async () => {
    await escolher('a1');
    const resumo = await screen.findByRole('list', { name: 'Quem recebe' });
    expect(within(resumo).getByText('140 recebem pela primeira vez.')).toBeInTheDocument();
    expect(within(resumo).getByText('3 com erro no envio da vez passada.')).toBeInTheDocument();
    const passou = within(resumo).getByRole('checkbox', { name: '12 já passaram por essa automação e recebem de novo' });
    const rodando = within(resumo).getByRole('checkbox', { name: '2 estão com essa automação rodando agora. Recomeçar pra eles' });
    expect(passou).toBeChecked();
    expect(rodando).not.toBeChecked();
    expect(within(resumo).getByText('Desmarcado, ficam de fora. Marcado, a automação deles para e começa de novo.')).toBeInTheDocument();
    // Regra da casa: nada de botão "Tirar"/"Recomeçar" solto fora do resumo.
    expect(screen.queryAllByRole('button', { name: /Tirar|Recomeçar/ })).toHaveLength(0);
  });

  it('desmarcar "já passou" e marcar "Recomeçar" reconta e vai no disparo, pelo número da automação', async () => {
    await escolher('a1');
    const resumo = await screen.findByRole('list', { name: 'Quem recebe' });
    await userEvent.click(within(resumo).getByRole('checkbox', { name: /já passaram/ }));
    await waitFor(() =>
      expect(s.previa).toHaveBeenLastCalledWith('p1', expect.anything(), 'in2', {
        flow_automation_id: 'a1',
        include_passed: false,
        restart_running: false,
      }),
    );
    await userEvent.click(within(resumo).getByRole('checkbox', { name: /Recomeçar pra eles/ }));
    await waitFor(() =>
      expect(s.previa).toHaveBeenLastCalledWith('p1', expect.anything(), 'in2', {
        flow_automation_id: 'a1',
        include_passed: false,
        restart_running: true,
      }),
    );
    const payload = await ateDisparar();
    expect(payload).toMatchObject({
      channel_kind: 'evolution',
      flow_automation_id: 'a1',
      inbox_id: 'in9',
      include_passed: false,
      restart_running: true,
    });
    expect(payload.funnel_items).toBeUndefined();
  });

  it('na revisão, as frases moram dentro do resumo e seguem as caixinhas', async () => {
    await escolher('a2');
    const resumo = await screen.findByRole('list', { name: 'Quem recebe' });
    await userEvent.click(within(resumo).getByRole('checkbox', { name: /Recomeçar pra eles/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Próximo' }));
    expect(await screen.findByText('Inclui 12 que já passaram por ela')).toBeInTheDocument();
    expect(screen.getByText('Recomeça pra 2 que estavam com ela rodando')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Teste|Mensagens/ })).toBeNull();
  });

  it('na revisão, sem "incluir quem já passou" não há frase', async () => {
    await escolher('a2');
    const resumo = await screen.findByRole('list', { name: 'Quem recebe' });
    await userEvent.click(within(resumo).getByRole('checkbox', { name: /já passaram/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Próximo' }));
    await screen.findByRole('button', { name: /Disparar pra/ });
    expect(screen.queryByText(/Inclui \d+ que já/)).toBeNull();
    expect(screen.queryByText(/Recomeça pra/)).toBeNull();
  });

  it('sem número próprio o disparo vai pelo número do passo 1, com as escolhas padrão', async () => {
    await escolher('a2');
    await screen.findByText(/e mais 40 blocos/);
    const payload = await ateDisparar();
    expect(payload).toMatchObject({
      flow_automation_id: 'a2',
      inbox_id: 'in2',
      include_passed: true,
      restart_running: false,
    });
  });

  it('voltando ao passo 1, o Número de saída aparece travado no da automação', async () => {
    await escolher('a1');
    await screen.findByRole('list', { name: 'Quem recebe' });
    await userEvent.click(screen.getByRole('button', { name: /Voltar/ }));
    expect(await screen.findByText('Sai pelo número da automação: IA Clara')).toBeInTheDocument();
    const campo = screen.getByLabelText('Número de saída');
    expect(campo).toBeDisabled();
    expect(screen.getByText('Pra escolher outro número, troque a automação no passo 2.')).toBeInTheDocument();
    expect(screen.queryByText(/Lead de outro corretor fica de fora/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeEnabled();
  });

  const numeroDaAutomacao = (sendable: boolean) => ({
    inbox_id: 'in9', name: 'IA Clara', phone: '5511999990009', connection: sendable ? 'open' : 'disconnected',
    owner_name: null, provider: 'evolution', sendable, reason: sendable ? null : 'disconnected',
  });

  it('número da automação desconectado: avisa, marca a ajuda e trava o Próximo', async () => {
    s.numeros.mockResolvedValue({ ...numeros, data: [...numeros.data, numeroDaAutomacao(false)] });
    await escolher('a1');
    expect(
      await screen.findByText('Sai pelo número da automação: IA Clara (desconectado). O número escolhido no passo 1 não vale pra ela.'),
    ).toBeInTheDocument();
    expect(screen.getByText('O número da automação está desconectado. Reconecte em Canais pra disparar.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeDisabled();
  });

  it('o resumo diz quem ficou de fora, sem caixinha, e some quando é zero', async () => {
    s.previa.mockImplementation(async (_p, _a, _i, fluxo?: { flow_automation_id?: string }) => ({
      ...previa(300, { opt_out: 2, other_owner: 3 }),
      ...(fluxo?.flow_automation_id && { flow: resumoDoFluxo, forced_inbox: null }),
    }));
    abrir();
    await screen.findByText('300 leads');
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('radio', { name: 'Automação' }));
    await userEvent.selectOptions(await screen.findByLabelText('Automação'), 'a2');
    const resumo = await screen.findByRole('list', { name: 'Quem recebe' });
    const linha = await within(resumo).findByText('5 ficaram de fora: 2 pediram pra parar, 3 são de outros corretores');
    expect(within(linha.closest('li') as HTMLElement).queryByRole('checkbox')).toBeNull();
  });

  it('prévia sem o resumo da automação: diz que ela não está pronta', async () => {
    s.previa.mockResolvedValue(previa(300));
    abrir();
    await screen.findByText('300 leads');
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('radio', { name: 'Automação' }));
    await userEvent.selectOptions(await screen.findByLabelText('Automação'), 'a2');
    expect(await screen.findByText('Essa automação não está pronta pra disparar. Escolha outra.')).toBeInTheDocument();
    expect(screen.queryByText('Contando destinatários...')).toBeNull();
  });

  it('automação sem ninguém pra receber: avisa e trava o Próximo', async () => {
    s.previa.mockImplementation(async (_p, _a, _i, fluxo?: { flow_automation_id?: string }) =>
      fluxo?.flow_automation_id
        ? { ...previa(0), flow: { passed: 0, passed_error: 0, running: 0, first_time: 0 }, forced_inbox: null }
        : previa(300),
    );
    abrir();
    await screen.findByText('300 leads');
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('radio', { name: 'Automação' }));
    await userEvent.selectOptions(await screen.findByLabelText('Automação'), 'a2');
    expect(await screen.findByText('Ninguém recebe com essa escolha.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeDisabled();
  });

  it('o link "e mais N blocos" avisa que abre em nova aba', async () => {
    await escolher('a1');
    const link = await screen.findByRole('link', { name: /e mais 8 blocos/ });
    expect(link).toHaveAccessibleName('e mais 8 blocos (abre em nova aba)');
  });

  it('na revisão, o canal da automação mostra o nome e o telefone do número', async () => {
    s.numeros.mockResolvedValue({ ...numeros, data: [...numeros.data, numeroDaAutomacao(true)] });
    await escolher('a1');
    await screen.findByRole('list', { name: 'Quem recebe' });
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Próximo' }));
    expect(await screen.findByText(/Campanha direta · IA Clara .*99999-0009/)).toBeInTheDocument();
  });

  it('as automações que falham ao carregar mostram o erro e Tentar de novo recupera', async () => {
    s.automacoes.mockRejectedValueOnce(new Error('rede'));
    s.previa.mockImplementation(previaComAutomacao);
    abrir();
    await screen.findByText('300 leads');
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('radio', { name: 'Automação' }));
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByLabelText('Automação')).toBeInTheDocument();
  });
});

describe('BulkDispatchModal · passo 1, Lista de leads', () => {
  const abrirComFechar = () =>
    render(
      <MemoryRouter>
        <BulkDispatchModal open onOpenChange={s.fechar} pipelineId="p1" pipelineName="Leads" stages={[]} />
      </MemoryRouter>,
    );
  const escolherLista = async () => {
    abrirComFechar();
    await screen.findByText('300 leads');
    await userEvent.click(await screen.findByRole('combobox', { name: /Enviar para/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Lista de leads' }));
    return screen.findByRole('dialog', { name: 'Escolher leads' });
  };
  const marcarDois = async (painel: HTMLElement) => {
    await userEvent.click(await within(painel).findByRole('checkbox', { name: /Pessoa Exemplo Um/ }));
    await userEvent.click(within(painel).getByRole('checkbox', { name: /Pessoa Exemplo Dois/ }));
  };
  const campoLeads = () => screen.getByRole('group', { name: 'Leads' });

  it('escolher "Lista de leads" abre o painel com os leads do funil', async () => {
    const painel = await escolherLista();
    expect(await within(painel).findByRole('checkbox', { name: /Pessoa Exemplo Um/ })).toBeInTheDocument();
    expect(s.leads).toHaveBeenCalledWith(expect.objectContaining({ pipeline_id: 'p1', page: 1 }));
  });

  it('sem lead marcado: o campo convida a escolher e o Próximo trava', async () => {
    await escolherLista();
    await userEvent.click(screen.getByRole('button', { name: 'Pronto' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Escolher leads' })).toBeNull());
    expect(within(campoLeads()).getByRole('button', { name: 'Escolher leads' })).toBeInTheDocument();
    expect(screen.getByText('Marque ao menos um lead pra contar os destinatários.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeDisabled();
  });

  it('marcar 2 e fechar mantém "2 leads escolhidos" e conta com a lista', async () => {
    s.previa.mockImplementation((_p: string, a: { mode: string; contact_ids?: string[] }) =>
      Promise.resolve(previa(a.mode === 'manual' ? a.contact_ids?.length ?? 0 : 300)),
    );
    const painel = await escolherLista();
    await marcarDois(painel);
    expect(within(painel).getByText('marcados').parentElement).toHaveTextContent('2 marcados');
    await userEvent.click(within(painel).getByRole('button', { name: 'Pronto' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Escolher leads' })).toBeNull());
    expect(campoLeads()).toHaveTextContent('2 leads escolhidos');
    expect(within(campoLeads()).getByRole('button', { name: 'Mudar' })).toHaveFocus();
    await waitFor(() =>
      expect(s.previa).toHaveBeenLastCalledWith('p1', expect.objectContaining({ mode: 'manual', contact_ids: ['c1', 'c2'] }), 'in2'),
    );
    expect(await screen.findByText('2 leads')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeEnabled();

    // Mudar reabre o painel com os mesmos marcados.
    await userEvent.click(within(campoLeads()).getByRole('button', { name: 'Mudar' }));
    const deNovo = await screen.findByRole('dialog', { name: 'Escolher leads' });
    expect(await within(deNovo).findByRole('checkbox', { name: /Pessoa Exemplo Um/ })).toHaveAttribute('data-state', 'checked');
    expect(within(deNovo).getByRole('checkbox', { name: /Pessoa Exemplo Três/ })).toHaveAttribute('data-state', 'unchecked');
  });

  it('Esc fecha o painel e não fecha a janela do disparo', async () => {
    const painel = await escolherLista();
    await marcarDois(painel);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Escolher leads' })).toBeNull());
    expect(screen.getByRole('dialog', { name: /Disparo em massa/ })).toBeInTheDocument();
    expect(s.fechar).not.toHaveBeenCalled();
    expect(campoLeads()).toHaveTextContent('2 leads escolhidos');
  });

  it('com o painel aberto não recontamos a cada clique: conta uma vez ao fechar', async () => {
    s.previa.mockImplementation((_p: string, a: { mode: string; contact_ids?: string[] }) =>
      Promise.resolve(previa(a.mode === 'manual' ? a.contact_ids?.length ?? 0 : 300)),
    );
    const painel = await escolherLista();
    await marcarDois(painel);
    expect(s.previa.mock.calls.filter(c => c[1].mode === 'manual')).toHaveLength(0);
    await userEvent.click(within(painel).getByRole('button', { name: 'Pronto' }));
    await waitFor(() => expect(s.previa.mock.calls.filter(c => c[1].mode === 'manual')).toHaveLength(1));
  });

  it('o disparo manda mode manual com os ids marcados', async () => {
    const painel = await escolherLista();
    await marcarDois(painel);
    await userEvent.click(within(painel).getByRole('button', { name: 'Pronto' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Escolher leads' })).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Próximo' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Preencher mensagem' }));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: /Disparar pra/ }));
    await waitFor(() => expect(s.criar).toHaveBeenCalled());
    expect(s.criar.mock.calls[0][0].audience).toEqual({ mode: 'manual', contact_ids: ['c1', 'c2'] });
  });
});

describe('BulkDispatchModal · corretor (só broadcasts.own)', () => {
  const comoCorretor = () =>
    s.pode.mockImplementation((r: string, a: string) => r === 'broadcasts' && a === 'own');

  it('o número aparece travado no dele e o canal oficial some, sem chamar as rotas do gestor', async () => {
    comoCorretor();
    s.numeros.mockResolvedValue({ data: [numeros.data[1]], default_inbox_id: 'in2' });
    abrir();
    const campo = await screen.findByLabelText('Número de saída');
    await waitFor(() => expect(campo).toHaveValue('in2'));
    expect(campo).toBeDisabled();
    expect(screen.queryByRole('radio', { name: /WhatsApp oficial/ })).toBeNull();
    expect(s.canais).not.toHaveBeenCalled();
    await waitFor(() => expect(s.previa).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: 'Próximo' })).toBeEnabled();
  });

  it('sem número próprio: aviso e Próximo travado', async () => {
    comoCorretor();
    s.numeros.mockResolvedValue({ data: [], default_inbox_id: null });
    abrir();
    expect(await screen.findByText('Você ainda não tem um número seu conectado. Fale com o gestor.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeDisabled();
  });

  it('gestor (create) segue vendo o canal oficial', async () => {
    abrir();
    expect(await screen.findByRole('radio', { name: /WhatsApp oficial/ })).toBeInTheDocument();
    await waitFor(() => expect(s.canais).toHaveBeenCalled());
  });
});
