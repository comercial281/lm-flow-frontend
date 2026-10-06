import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';
import Abertura from './Abertura';

describe('Abertura', () => {
  it('"Com texto de base" mostra o texto (sem gravar); "Automática" limpa o texto gravado', async () => {
    const gravar = gravarDeTeste('abertura');
    render(<><Abertura agent={agenteDeTeste()} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} /><button>fora</button></>);
    await userEvent.click(screen.getByRole('radio', { name: 'Com texto de base' }));
    expect(gravar).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Texto de base'), 'Oi, tudo bem?');
    await userEvent.click(screen.getByText('fora'));
    expect(gravar).toHaveBeenCalledWith({ greeting: 'Oi, tudo bem?' });
  });

  it('variações em tabela, com etiquetas do que cada uma tem, e Editar abre a janela', async () => {
    const openings = [{ label: 'Vila Nova · Stories', origins: [], form_ids: ['123'], keywords: [], image_url: 'https://x/i.png' }];
    render(<Abertura agent={agenteDeTeste({ openings, greeting: 'Oi' })} inboxes={[]} gravar={gravarDeTeste('abertura')} irPara={vi.fn()} diagnostico={null} />);
    const linha = screen.getByText('Vila Nova · Stories').closest('li')!;
    expect(within(linha).getByText('Formulário')).toBeInTheDocument();
    expect(within(linha).getByText('Imagem')).toBeInTheDocument();
    await userEvent.click(within(linha).getByRole('button', { name: 'Editar Vila Nova · Stories' }));
    expect(screen.getByRole('dialog', { name: 'Variação: Vila Nova · Stories' })).toBeInTheDocument();
  });

  it('Nova variação grava a lista com a nova no fim', async () => {
    const gravar = gravarDeTeste('abertura');
    render(<Abertura agent={agenteDeTeste()} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} />);
    await userEvent.click(screen.getByRole('button', { name: 'Nova variação' }));
    expect(gravar).toHaveBeenCalledWith({ openings: [{ label: 'Nova campanha', origins: [], form_ids: [], keywords: [] }] });
  });
});
