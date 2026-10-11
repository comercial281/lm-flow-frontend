import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import ProvaSocial from './ProvaSocial';

function abrir(social_proof: string | null) {
  const gravar = vi.fn().mockResolvedValue(true);
  const confirmar = vi.fn().mockResolvedValue(true);
  const tela = (texto: string | null) => <ProvaSocial agent={agenteDeTeste({ social_proof: texto })} gravar={gravar} confirmar={confirmar}
    licoes={{} as never} arquivos={{} as never} irPara={vi.fn()} />;
  const { rerender } = render(tela(social_proof));
  return { gravar, confirmar, reler: (texto: string | null) => rerender(tela(texto)) };
}

describe('Prova social', () => {
  it('um caso por linha', () => {
    abrir('300 famílias\nNota 4,9');
    expect(screen.getByText('300 famílias')).toBeInTheDocument();
    expect(screen.getByText('Nota 4,9')).toBeInTheDocument();
  });

  it('adicionar grava o texto inteiro com o caso novo no fim', async () => {
    const { gravar } = abrir('A');
    await userEvent.type(screen.getByLabelText('Novo caso'), 'B');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(gravar).toHaveBeenCalledWith({ social_proof: 'A\nB' });
  });

  it('excluir o único caso grava vazio (null), depois de confirmar', async () => {
    const { gravar, confirmar } = abrir('A');
    await userEvent.click(screen.getByRole('button', { name: 'Ações do caso 1' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Excluir caso', rotuloDaAcao: 'Excluir' }));
    expect(gravar).toHaveBeenCalledWith({ social_proof: null });
  });

  it('excluir um caso fecha a edição aberta de outro (a posição anda) e nada grava no caso errado', async () => {
    const { gravar, reler } = abrir('A\nB\nC');
    await userEvent.click(screen.getByRole('button', { name: 'Ações do caso 2' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));
    await userEvent.type(screen.getByLabelText('Editar caso'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Ações do caso 1' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    expect(gravar).toHaveBeenCalledTimes(1);
    expect(gravar).toHaveBeenCalledWith({ social_proof: 'B\nC' });
    reler('B\nC');
    expect(screen.queryByLabelText('Editar caso')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pronto' })).not.toBeInTheDocument();
    expect(gravar).toHaveBeenCalledTimes(1);
  });

  it('sem caso, o vazio explica', () => {
    abrir(null);
    expect(screen.getByText('Nenhum caso ainda')).toBeInTheDocument();
  });
});
