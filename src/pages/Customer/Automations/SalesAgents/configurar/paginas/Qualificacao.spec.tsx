import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';
import Qualificacao from './Qualificacao';

const abrir = (agent = agenteDeTeste(), irPara = vi.fn()) => {
  const gravar = gravarDeTeste('qualificacao');
  render(<><Qualificacao agent={agent} inboxes={[]} gravar={gravar} irPara={irPara} diagnostico={null} /><button>fora</button></>);
  return { gravar, irPara };
};

describe('Qualificação', () => {
  it('"Obrigatória" por linha grava a lista e as obrigatórias juntas', async () => {
    const { gravar } = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Pergunta 2 é obrigatória' }));
    expect(gravar).toHaveBeenCalledWith({
      qualification_questions: ['Renda', 'Quartos'],
      transfer_config: { mode: 'checklist', required_questions: ['Renda', 'Quartos'], voice: 'first_person' },
    }, ['transfer_config.required_questions']);
  });

  it('não deixa desmarcar a última obrigatória', async () => {
    const { gravar } = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Pergunta 1 é obrigatória' }));
    expect(gravar).not.toHaveBeenCalled();
    expect(screen.getByText(/Pelo menos uma pergunta precisa ser obrigatória/)).toBeInTheDocument();
  });

  it('descer reordena; adicionar entra no fim; editar grava ao sair', async () => {
    const { gravar } = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Descer pergunta 1' }));
    expect(gravar.mock.calls[0][0].qualification_questions).toEqual(['Quartos', 'Renda']);
    await userEvent.type(screen.getByLabelText('Nova pergunta'), 'Vai financiar?');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(gravar.mock.calls[1][0].qualification_questions).toEqual(['Quartos', 'Renda', 'Vai financiar?']);
  });

  it('fora do critério das obrigatórias, avisa e leva ao Critério', async () => {
    const { irPara } = abrir(agenteDeTeste({ transfer_config: { mode: 'temperatura' } }));
    await userEvent.click(screen.getByRole('button', { name: 'Abrir Critério' }));
    expect(irPara).toHaveBeenCalledWith('criterio');
  });

  it('editar uma linha e clicar em "Obrigatória" de outra grava com o texto NOVO', async () => {
    const { gravar } = abrir();
    const campo = screen.getByLabelText('Pergunta 1');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Renda familiar');
    await userEvent.click(screen.getByRole('button', { name: 'Pergunta 2 é obrigatória' }));
    expect(gravar.mock.calls[0][0].qualification_questions).toEqual(['Renda familiar', 'Quartos']);
    expect(gravar.mock.calls[1][0].qualification_questions).toEqual(['Renda familiar', 'Quartos']);
    expect(gravar.mock.calls[1][0].transfer_config.required_questions).toEqual(['Renda familiar', 'Quartos']);
  });

  it('linha esvaziada volta pro texto salvo ao sair', async () => {
    const { gravar } = abrir();
    await userEvent.clear(screen.getByLabelText('Pergunta 1'));
    await userEvent.click(screen.getByRole('button', { name: 'fora' }));
    expect(screen.getByLabelText('Pergunta 1')).toHaveValue('Renda');
    expect(gravar).not.toHaveBeenCalled();
  });
});
