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
}));
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
  it('cria pelo modelo aprovado com o teto de gasto, o ritmo normal e sem número de saída', async () => {
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
    await userEvent.type(screen.getByLabelText('Teto de gasto (R$)'), '12,5');
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: /Disparar pra 300/ }));
    await waitFor(() => expect(s.criar).toHaveBeenCalled());
    const payload = s.criar.mock.calls[0][0];
    expect(payload).toMatchObject({ channel_kind: 'whatsapp_cloud', pace: 'normal', max_spend: 12.5 });
    expect(payload.template_config).toMatchObject({ template_name: 'oferta' });
    expect(payload.inbox_id).toBeUndefined();
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
