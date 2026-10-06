import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CartoesDeEscolha from './CartoesDeEscolha';

const PERSONAS = [
  { valor: 'broker', rotulo: 'O corretor', descricao: 'Fala em primeira pessoa como o dono do número.' },
  { valor: 'assistant', rotulo: 'Consultora da imobiliária', descricao: 'Fala em nome da imobiliária.' },
];

describe('CartoesDeEscolha', () => {
  it('cada cartão é um rádio com o título como nome e a frase como descrição', () => {
    render(<CartoesDeEscolha rotulo="Persona" valor="assistant" opcoes={PERSONAS} aoEscolher={vi.fn()} />);
    const cartao = screen.getByRole('radio', { name: 'Consultora da imobiliária' });
    expect(cartao).toHaveAttribute('aria-checked', 'true');
    expect(cartao).toHaveAccessibleDescription('Fala em nome da imobiliária.');
  });

  it('clicar escolhe', async () => {
    const aoEscolher = vi.fn();
    render(<CartoesDeEscolha rotulo="Persona" valor="assistant" opcoes={PERSONAS} aoEscolher={aoEscolher} />);
    await userEvent.click(screen.getByRole('radio', { name: 'O corretor' }));
    expect(aoEscolher).toHaveBeenCalledWith('broker');
  });

  it('desabilitado mostra o motivo no lugar da frase e não escolhe', async () => {
    const aoEscolher = vi.fn();
    render(
      <CartoesDeEscolha rotulo="Quando ela passa" valor="checklist" aoEscolher={aoEscolher}
        opcoes={[
          { valor: 'checklist', rotulo: 'Perguntas obrigatórias respondidas' },
          { valor: 'pos_visita', rotulo: 'Visita marcada', descricao: 'Só passa com a visita na agenda.', desabilitada: true, motivo: 'Só com o objetivo "Agendar visita".' },
        ]} />,
    );
    const visita = screen.getByRole('radio', { name: 'Visita marcada' });
    expect(visita).toHaveAccessibleDescription('Só com o objetivo "Agendar visita".');
    await userEvent.click(visita);
    expect(aoEscolher).not.toHaveBeenCalled();
  });
});
