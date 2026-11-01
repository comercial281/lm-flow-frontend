import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { AgentNumber, SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';

const servico = vi.hoisted(() => ({
  criarNumero: vi.fn(), atualizarNumero: vi.fn(), tirarNumero: vi.fn(), resumos: vi.fn(), get: vi.fn(), list: vi.fn(),
}));
vi.mock('@/services/salesAgents/salesAgentsService', async (orig) => {
  const real = await orig<typeof import('@/services/salesAgents/salesAgentsService')>();
  return { ...real, salesAgentsService: { ...real.salesAgentsService, ...servico } };
});
const toastErro = vi.hoisted(() => vi.fn());
const toastAviso = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: toastErro, warning: toastAviso, success: vi.fn() }) }));
import NumerosEUsuarios from './NumerosEUsuarios';

const INBOXES = [
  { id: 'inbox-1', name: 'Número Ana', oficial: false }, { id: 'inbox-2', name: 'Número Bia', oficial: false },
  { id: 'inbox-3', name: 'Número Caio', oficial: false }, { id: 'inbox-4', name: 'Número Oficial', oficial: true },
];
const numero = (extra: Partial<AgentNumber>): AgentNumber => ({
  id: 'n1', inbox_id: 'inbox-1', phone: null, inbox_name: 'Número Ana', enabled: true, connected: true, voice: null, triggers: null,
  position: 0, owner_user_id: 'u1', owner_name: 'Ana', ...extra,
});
const agente = (extra: Partial<SalesAgent> = {}) => agenteDeTeste({
  handoff_target: 'number_owner',
  house_voice: { kind: 'consultora', name: 'Maria', gender: 'ela', intro: 'sou do time da Aurora Imóveis' },
  triggers: [{ type: 'form', form_ids: ['f9'] }],
  numbers: [
    numero({ voice: { kind: 'corretor', name: 'Ana', intro: 'sou a Ana, corretora' }, triggers: [{ type: 'form', form_ids: ['f1', 'f2'] }] }),
    numero({ id: 'n2', inbox_id: 'inbox-2', inbox_name: 'Número Bia', owner_user_id: 'u2', owner_name: 'Bia', connected: false }),
  ],
  ...extra,
});

// A casca de verdade guarda a IA e entrega pra página: aqui o `get` do servidor de mentira é quem manda.
let servidor: SalesAgent;
function abrir(inicial: SalesAgent = agente(), { gravar = gravarDeTeste('numeros'), irPara = vi.fn() } = {}) {
  servidor = inicial;
  servico.get.mockImplementation(async () => servidor);
  function Casca() {
    const [a, setA] = useState(inicial);
    return <NumerosEUsuarios agent={a} inboxes={INBOXES} gravar={gravar} irPara={irPara} diagnostico={null} aoSalvo={setA} />;
  }
  render(<Casca />);
  return { gravar, irPara };
}
const cartao = (nome: string) => within(screen.getByRole('article', { name: nome }));

beforeEach(() => {
  Object.values(servico).forEach((f) => f.mockReset());
  toastErro.mockReset(); toastAviso.mockReset();
  servico.resumos.mockResolvedValue([{ id: 'ia-1', conversations: 23, handoffs: 3, median_reply_minutes: 4, numbers: [{ inbox_id: 'inbox-1', conversations: 23 }] }]);
  servico.list.mockResolvedValue([]);
});

describe('Números e usuários · cartões', () => {
  it('um cartão por número: usuário, conexão, prévia, voz e o que ela faz, formulários e conversas de 30 dias', async () => {
    abrir();
    const ana = cartao('Ana');
    expect(ana.getByText('conectado')).toBeInTheDocument();
    expect(ana.getByText('Oi, Maria! Sou a Ana, corretora. Vi que você se interessou pelo Residencial Teste. Me conta: é pra morar ou pra investir?')).toBeInTheDocument();
    expect(ana.getByText('Corretor')).toBeInTheDocument();
    expect(ana.getByText(/Fala como o próprio dono do número/)).toBeInTheDocument();
    expect(ana.getByText('2 formulários')).toBeInTheDocument();
    expect(await ana.findByText('23 conversas em 30 dias')).toBeInTheDocument();

    const bia = cartao('Bia');
    expect(bia.getByText('desconectado')).toBeInTheDocument();
    expect(bia.getByText('Consultora')).toBeInTheDocument();
    // sem ficha própria: a prévia vem da casa; gatilho herdado: o formulário do agente
    expect(bia.getByText(/Oi, Maria! Sou do time da Aurora Imóveis\./)).toBeInTheDocument();
    expect(bia.getByText('1 formulário')).toBeInTheDocument();
    // número sem conversa em 30 dias não vem no resumo: 0
    expect(await bia.findByText('0 conversas em 30 dias')).toBeInTheDocument();
  });

  it('trocar a voz grava pelo atualizarNumero, relê o agente e muda a prévia e a linha', async () => {
    abrir();
    servico.atualizarNumero.mockImplementation(async (_a: string, _n: string, body: { voice: AgentNumber['voice'] }) => {
      servidor = { ...servidor, numbers: servidor.numbers.map((n) => (n.id === 'n1' ? { ...n, voice: body.voice } : n)) };
      return { ...servidor.numbers[0], warnings: [] };
    });
    await userEvent.click(cartao('Ana').getByRole('button', { name: 'Editar ficha' }));
    await userEvent.selectOptions(cartao('Ana').getByLabelText('Quem fala'), 'dono_gerente');
    expect(servico.atualizarNumero).toHaveBeenCalledWith('ia-1', 'n1', { voice: { kind: 'dono_gerente', name: 'Ana', intro: 'sou a Ana, corretora' } });
    expect(servico.get).toHaveBeenCalledWith('ia-1');
    expect(await cartao('Ana').findByText(/Fala como quem manda/)).toBeInTheDocument();
    expect(cartao('Ana').getByText('Dono ou gerente', { selector: 'span' })).toBeInTheDocument();
  });

  it('"Igual à casa" tira o campo da ficha do número; ficha vazia volta pra nula', async () => {
    abrir(agente({ numbers: [numero({ voice: { kind: 'corretor' } })] }));
    servico.atualizarNumero.mockResolvedValue({ ...numero({}), warnings: [] });
    await userEvent.click(cartao('Ana').getByRole('button', { name: 'Editar ficha' }));
    await userEvent.selectOptions(cartao('Ana').getByLabelText('Quem fala'), '');
    expect(servico.atualizarNumero).toHaveBeenCalledWith('ia-1', 'n1', { voice: null });
  });

  it('nome e "como se apresenta" gravam ao sair do campo, com até 200 caracteres', async () => {
    abrir();
    servico.atualizarNumero.mockResolvedValue({ ...numero({}), warnings: [] });
    await userEvent.click(cartao('Bia').getByRole('button', { name: 'Editar ficha' }));
    const intro = cartao('Bia').getByLabelText('Como se apresenta');
    expect(intro).toHaveAttribute('maxlength', '200');
    await userEvent.type(intro, 'sou a Bia, corretora');
    await userEvent.tab();
    expect(servico.atualizarNumero).toHaveBeenCalledWith('ia-1', 'n2', { voice: { intro: 'sou a Bia, corretora' } });
  });

  it('Corretor com destino fora de "Fica com o dono do número" avisa; com o destino certo, não', () => {
    abrir(agente({ handoff_target: 'roleta' }));
    expect(cartao('Ana').getByText('A voz Corretor pede o destino "Fica com o dono do número".')).toBeInTheDocument();
    expect(cartao('Bia').queryByText(/pede o destino/)).toBeNull();
  });

  it('com o destino certo não avisa', () => {
    abrir(agente({ handoff_target: 'number_owner' }));
    expect(screen.queryByText(/pede o destino/)).toBeNull();
  });

  it('número com outro agente ligado e sem gatilho mostra o aviso da divisão', async () => {
    servico.list.mockResolvedValue([
      agente(),
      agenteDeTeste({ id: 'ia-2', name: 'Agente B', enabled: true, triggers: [], trigger_keyword: null, numbers: [numero({ id: 'x', inbox_id: 'inbox-2' })] }),
    ]);
    abrir();
    expect(await cartao('Bia').findByText(/o agente Agente B vai precisar de gatilhos/)).toBeInTheDocument();
    expect(cartao('Ana').queryByText(/vai precisar de gatilhos/)).toBeNull();
  });

  it('número da API oficial leva o aviso do que ainda não funciona', () => {
    abrir(agente({ numbers: [numero({ inbox_id: 'inbox-4', inbox_name: 'Número Oficial', owner_name: 'Dani' })] }));
    expect(screen.getByText(/Pela API oficial a IA responde normalmente quem chamar/)).toBeInTheDocument();
  });
});

describe('Números e usuários · tirar e adicionar', () => {
  it('tirar confirma antes e só então tira; depois relê o agente', async () => {
    abrir();
    servico.tirarNumero.mockImplementation(async () => { servidor = { ...servidor, numbers: servidor.numbers.slice(0, 1) }; });
    await userEvent.click(cartao('Bia').getByRole('button', { name: 'Tirar número' }));
    expect(servico.tirarNumero).not.toHaveBeenCalled();
    const janela = within(await screen.findByRole('dialog'));
    expect(janela.getByText('Tirar este número do agente?')).toBeInTheDocument();
    await userEvent.click(janela.getByRole('button', { name: 'Cancelar' }));
    expect(servico.tirarNumero).not.toHaveBeenCalled();
    await userEvent.click(cartao('Bia').getByRole('button', { name: 'Tirar número' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Tirar' }));
    expect(servico.tirarNumero).toHaveBeenCalledWith('ia-1', 'n2');
    await vi.waitFor(() => expect(screen.queryByRole('article', { name: 'Bia' })).toBeNull());
  });

  it('+ Adicionar número cria pelo criarNumero só com o número escolhido (a ficha vem da casa)', async () => {
    abrir();
    servico.criarNumero.mockResolvedValue({ ...numero({ id: 'n3', inbox_id: 'inbox-3' }), warnings: [] });
    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar número' }));
    const lista = screen.getByLabelText('Número de WhatsApp');
    expect(within(lista).queryByRole('option', { name: 'Número Ana' })).toBeNull();
    await userEvent.selectOptions(lista, 'inbox-3');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(servico.criarNumero).toHaveBeenCalledWith('ia-1', { inbox_id: 'inbox-3' });
    expect(servico.get).toHaveBeenCalledWith('ia-1');
  });

  it('o aviso do servidor sobre a divisão aparece depois de criar', async () => {
    abrir();
    servico.criarNumero.mockResolvedValue({ ...numero({ id: 'n3', inbox_id: 'inbox-3' }), warnings: ['Pra dividir este número, o Agente B precisa de gatilhos.'] });
    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar número' }));
    await userEvent.selectOptions(screen.getByLabelText('Número de WhatsApp'), 'inbox-3');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    await vi.waitFor(() => expect(toastAviso).toHaveBeenCalledWith('Pra dividir este número, o Agente B precisa de gatilhos.'));
  });

  it('o servidor recusou: mostra a frase dele e não relê', async () => {
    abrir();
    servico.criarNumero.mockRejectedValue({ response: { data: { error: { message: 'Este agente já está neste número.' } } } });
    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar número' }));
    await userEvent.selectOptions(screen.getByLabelText('Número de WhatsApp'), 'inbox-3');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    await vi.waitFor(() => expect(toastErro).toHaveBeenCalledWith('Este agente já está neste número.'));
    expect(servico.get).not.toHaveBeenCalled();
  });
});

describe('Números e usuários · padrão da casa e horário', () => {
  it('o padrão da casa grava pelo gravar, por subchave', async () => {
    const { gravar } = abrir();
    const casa = within(screen.getByRole('region', { name: 'Padrão da casa' }));
    await userEvent.selectOptions(casa.getByLabelText('Ele ou ela'), 'ele');
    expect(gravar).toHaveBeenLastCalledWith({ house_voice: { kind: 'consultora', name: 'Maria', gender: 'ele', intro: 'sou do time da Aurora Imóveis' } }, ['house_voice.gender']);
    await userEvent.selectOptions(casa.getByLabelText('Quem fala'), 'corretor');
    expect(gravar).toHaveBeenLastCalledWith({ house_voice: expect.objectContaining({ kind: 'corretor' }) }, ['house_voice.kind']);
    expect(servico.atualizarNumero).not.toHaveBeenCalled();
  });

  it('a prévia da casa muda com o que ela diz de si', () => {
    abrir();
    const casa = within(screen.getByRole('region', { name: 'Padrão da casa' }));
    expect(casa.getByText(/Oi, Maria! Sou do time da Aurora Imóveis\./)).toBeInTheDocument();
    expect(casa.getByText(/Fala como alguém do time/)).toBeInTheDocument();
  });

  it('o horário continua na página', () => {
    abrir();
    expect(screen.getByRole('radio', { name: '24 horas' })).toBeInTheDocument();
  });
});
