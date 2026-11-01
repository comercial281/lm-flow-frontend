import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';

vi.mock('@/features/visits/useAgendaLigada', () => ({ useAgendaLigada: () => ({ ligada: false }) }));
vi.mock('@/services/salesAgents/salesAgentsService', async (orig) => {
  const real = await orig<typeof import('@/services/salesAgents/salesAgentsService')>();
  return { ...real, salesAgentsService: { ...real.salesAgentsService, playbook: vi.fn().mockResolvedValue({ slot_defaults: {} }) } };
});
import ModoOperante from './ModoOperante';

const PRONTAS = { recusou_documento: true, pediu_ligacao: true, nao_sei: false, pediu_pra_visitar: true, objecao_sem_contorno: false };

function abrir(extra: Partial<SalesAgent> = {}) {
  const gravar = gravarDeTeste('modo');
  const agent = agenteDeTeste({ job: 'filtra_passa', next_steps: ['visita'], handoff_exceptions: { prontas: PRONTAS, escritas: ['É corretor parceiro'] }, ...extra });
  render(<><ModoOperante agent={agent} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} /><button>fora</button></>);
  return gravar;
}

describe('Modo operante', () => {
  it('o cartão grava o trabalho na hora', async () => {
    const gravar = abrir();
    expect(screen.getByRole('radio', { name: /^Filtra e passa/ })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: /^Leva até a visita/ }));
    expect(gravar).toHaveBeenCalledWith({ job: 'leva_visita' });
  });

  it('a agenda só aparece no Leva até a visita', () => {
    abrir({ job: 'filtra_passa' });
    expect(screen.queryByText('Janela de visita')).toBeNull();
  });

  it('no Leva até a visita a agenda aparece dentro da página', () => {
    abrir({ job: 'leva_visita' });
    expect(screen.getByText('Janela de visita')).toBeInTheDocument();
  });

  it('agente sem trabalho gravado segue o servidor: booking_enabled falso não mostra a agenda', () => {
    abrir({ job: null, booking_enabled: false });
    expect(screen.queryByText('Janela de visita')).toBeNull();
  });

  it('a frase de fechamento muda com o que está marcado e com o modo', async () => {
    const gravar = abrir();
    expect(screen.getByText(/Quer conhecer o imóvel\? Já te passo pro corretor ver o melhor horário\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Reunião por vídeo' }));
    expect(gravar).toHaveBeenCalledWith({ next_steps: ['visita', 'videochamada'] });
  });

  it('Leva até a visita fecha perguntando o dia', () => {
    abrir({ job: 'leva_visita', next_steps: ['visita', 'videochamada'] });
    expect(screen.getByText(/Você prefere conhecer o imóvel ou fazer uma chamada de vídeo\? Qual dia fica melhor pra você\?/)).toBeInTheDocument();
  });

  it('o último próximo passo não desmarca', async () => {
    const gravar = abrir({ next_steps: ['visita'] });
    const caixa = screen.getByRole('checkbox', { name: 'Visita' });
    expect(caixa).toBeDisabled();
    await userEvent.click(caixa);
    expect(gravar).not.toHaveBeenCalled();
  });

  it('com Reunião no escritório pede o endereço do escritório, que grava na ficha da casa', async () => {
    const gravar = abrir({ next_steps: ['reuniao'], house_voice: { kind: 'consultora', name: 'Ana' } });
    await userEvent.type(screen.getByLabelText('Endereço do escritório'), 'Rua Teste, 100');
    await userEvent.click(screen.getByText('fora'));
    expect(gravar).toHaveBeenLastCalledWith({ house_voice: { kind: 'consultora', name: 'Ana', office_address: 'Rua Teste, 100' } }, ['house_voice.office_address']);
  });

  it('sem Reunião no escritório não pede o endereço', () => {
    abrir({ next_steps: ['visita'] });
    expect(screen.queryByLabelText('Endereço do escritório')).toBeNull();
  });

  it('"Pediu pra visitar" só no Filtra e passa; as sempre ligadas não têm chave', () => {
    const { unmount } = render(<></>);
    unmount();
    abrir({ job: 'filtra_passa' });
    expect(screen.getByRole('checkbox', { name: 'Pediu pra visitar' })).toBeChecked();
    expect(screen.getByText('Lead irritado')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Lead irritado' })).toBeNull();
  });

  it('no Leva até a visita "Pediu pra visitar" some', () => {
    abrir({ job: 'leva_visita' });
    expect(screen.queryByRole('checkbox', { name: 'Pediu pra visitar' })).toBeNull();
  });

  it('as caixinhas mostram o que o servidor diz que vale agora (handoff_exceptions_effective)', () => {
    abrir({ handoff_exceptions: null, handoff_exceptions_effective: { ...PRONTAS, nao_sei: true, recusou_documento: false } });
    expect(screen.getByRole('checkbox', { name: 'Ela não sabe responder' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Recusou mandar documento' })).not.toBeChecked();
  });

  it('ligar uma pronta grava as cinco e mantém as escritas', async () => {
    const gravar = abrir();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ela não sabe responder' }));
    expect(gravar).toHaveBeenCalledWith({ handoff_exceptions: { prontas: { ...PRONTAS, nao_sei: true }, escritas: ['É corretor parceiro'] } });
  });

  it('escrita nova mantém as prontas; tirar uma escrita também', async () => {
    const gravar = abrir();
    await userEvent.type(screen.getByLabelText('Outro motivo'), 'pediu financiamento com renda informal');
    await userEvent.click(screen.getByRole('button', { name: 'Pôr' }));
    expect(gravar).toHaveBeenLastCalledWith({ handoff_exceptions: { prontas: PRONTAS, escritas: ['É corretor parceiro', 'pediu financiamento com renda informal'] } });
    await userEvent.click(screen.getByRole('button', { name: 'Tirar: É corretor parceiro' }));
    expect(gravar).toHaveBeenLastCalledWith({ handoff_exceptions: { prontas: PRONTAS, escritas: [] } });
  });
});
