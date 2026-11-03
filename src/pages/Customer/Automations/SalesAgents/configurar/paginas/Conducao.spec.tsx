import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';
import Conducao from './Conducao';

vi.mock('@/services/salesAgents/salesAgentsService', async (original) => ({
  ...(await original<typeof import('@/services/salesAgents/salesAgentsService')>()),
  salesAgentsService: { voices: vi.fn().mockResolvedValue([]) },
}));

const abrir = (extra = {}) => {
  const gravar = gravarDeTeste('conducao');
  render(<><Conducao agent={agenteDeTeste(extra)} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} /><button>fora</button></>);
  return gravar;
};

describe('Condução', () => {
  it('quatro blocos, nesta ordem', () => {
    abrir();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Abertura', 'O que descobrir', 'Formato das respostas', 'Restrições',
    ]);
  });

  it('Abertura sem variações por campanha (isso é da página Campanhas e gatilhos)', () => {
    abrir();
    expect(screen.queryByText('Variações por campanha')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nova variação' })).toBeNull();
  });

  it('Abertura grava texto de base, origem, imagem e áudio só com campos da página', async () => {
    const gravar = abrir();
    await userEvent.click(screen.getByRole('radio', { name: 'Com texto de base' }));
    await userEvent.type(screen.getByLabelText('Texto de base'), 'Oi, tudo bem?');
    await userEvent.type(screen.getByLabelText(/Quando não souber o anúncio/), 'nosso anúncio');
    await userEvent.click(screen.getByText('fora'));
    expect(gravar).toHaveBeenCalledWith({ greeting: 'Oi, tudo bem?' });
    expect(gravar).toHaveBeenCalledWith({ default_origin: 'nosso anúncio' });
  });

  it('O que descobrir traz as travas em uma linha e grava as obrigatórias', async () => {
    const gravar = abrir();
    expect(screen.getByText('Nunca pergunta o que o formulário já respondeu; uma pergunta por mensagem; no máximo 2 vezes a mesma.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pergunta 2 é obrigatória' }));
    expect(gravar.mock.calls[0][1]).toEqual(['transfer_config.required_questions']);
  });

  it('não manda mais pro Modo operante trocar o critério (ele não existe mais)', () => {
    abrir({ transfer_config: { mode: 'temperatura' } });
    expect(screen.queryByRole('button', { name: 'Abrir Modo operante' })).toBeNull();
    expect(screen.queryByText(/critério/i)).toBeNull();
  });

  it('Formato das respostas junta várias mensagens, áudio e curtidas', async () => {
    const gravar = abrir();
    await userEvent.click(screen.getByRole('switch', { name: 'Responder em várias mensagens' }));
    expect(gravar).toHaveBeenCalledWith({ message_split_enabled: false });
    expect(screen.getByRole('switch', { name: 'Responder em áudio' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Curtir mensagens do lead' }));
    expect(gravar).toHaveBeenCalledWith({ reaction_enabled: true });
  });

  it('Restrições grava as subchaves de ai_limits', async () => {
    const gravar = abrir();
    await userEvent.click(screen.getByRole('button', { name: /Desconto/ }));
    expect(gravar.mock.calls.at(-1)![1]).toContain('ai_limits.discount');
  });
});
