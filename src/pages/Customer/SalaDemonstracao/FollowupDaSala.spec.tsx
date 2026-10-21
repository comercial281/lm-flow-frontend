import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FollowupDaSala from './FollowupDaSala';
import type { FollowupStep } from '@/types/demoRoom';

const s = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { list: s.list } }));

const steps: FollowupStep[] = [
  { step: 1, kinds: ['texto'], preview: 'Oi Maria, tudo bem?', real_delay: 'na hora', status: 'enviado' },
  { step: 2, kinds: ['audio'], preview: 'Áudio de lembrete', real_delay: '1 dia depois', status: 'proximo' },
  { step: 3, kinds: ['video', 'book'], preview: 'Vídeo do empreendimento', real_delay: '3 dias depois', status: 'depois' },
];

beforeEach(() => { s.list.mockReset(); s.list.mockResolvedValue([]); });

describe('FollowupDaSala', () => {
  it('mostra os passos com o tempo da vida real e os selos', () => {
    render(<FollowupDaSala steps={steps} onAgora={vi.fn()} />);
    expect(screen.getByText('na hora')).toBeInTheDocument();
    expect(screen.getByText('1 dia depois')).toBeInTheDocument();
    expect(screen.getByText('3 dias depois')).toBeInTheDocument();
    expect(screen.getByText('Oi Maria, tudo bem?')).toBeInTheDocument();
    expect(screen.getByText('Enviado')).toBeInTheDocument();
    expect(screen.getByText('Próximo')).toBeInTheDocument();
  });

  it('clicar chama onAgora, trava durante o envio e mostra a mensagem', async () => {
    let resolver: (v: { ok: boolean; message: string }) => void = () => {};
    const onAgora = vi.fn(() => new Promise<{ ok: boolean; message: string }>(r => { resolver = r; }));
    render(<FollowupDaSala steps={steps} onAgora={onAgora} />);
    const botao = screen.getByRole('button', { name: 'Simular que o lead sumiu' });
    await userEvent.click(botao);
    expect(onAgora).toHaveBeenCalledTimes(1);
    expect(botao).toBeDisabled();
    resolver({ ok: true, message: 'Enviando agora.' });
    expect(await screen.findByText('Enviando agora.')).toBeInTheDocument();
    await waitFor(() => expect(botao).toBeEnabled());
  });

  it('ok false mostra a mensagem do servidor', async () => {
    const onAgora = vi.fn().mockResolvedValue({ ok: false, message: 'O follow-up já mostrou todas as mensagens.' });
    render(<FollowupDaSala steps={steps} onAgora={onAgora} />);
    await userEvent.click(screen.getByRole('button', { name: 'Simular que o lead sumiu' }));
    expect(await screen.findByText('O follow-up já mostrou todas as mensagens.')).toBeInTheDocument();
  });

  it('explica que na vida real o follow-up para quando o lead responde', () => {
    render(<FollowupDaSala steps={steps} onAgora={vi.fn()} />);
    expect(screen.getByText('Na vida real, o follow-up para quando o lead responde. Aqui ele segue pra você ver todos os formatos.')).toBeInTheDocument();
  });

  it('mostra os três outros jeitos, com 2 h e 8 h por padrão', async () => {
    render(<FollowupDaSala steps={steps} onAgora={vi.fn()} />);
    expect(screen.getByText('Outros jeitos de fazer follow-up')).toBeInTheDocument();
    expect(screen.getByText('Retomada escrita pela IA na hora')).toBeInTheDocument();
    expect(screen.getByText('Follow-up que anda pela coluna do funil')).toBeInTheDocument();
    expect(screen.getByText('Follow-up do corretor com a própria voz')).toBeInTheDocument();
    expect(screen.getByText(/2 h e 8 h depois/)).toBeInTheDocument();
  });

  it('lê as horas da retomada da IA da Sala', async () => {
    s.list.mockResolvedValue([{ id: 'a1', reengagement_first_hours: 3, reengagement_second_hours: 12 }]);
    render(<FollowupDaSala steps={steps} onAgora={vi.fn()} agentId="a1" />);
    expect(await screen.findByText(/3 h e 12 h depois/)).toBeInTheDocument();
  });
});
