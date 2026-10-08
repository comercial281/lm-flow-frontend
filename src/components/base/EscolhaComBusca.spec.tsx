import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import EscolhaComBusca from './EscolhaComBusca';

const MUITAS = Array.from({ length: 30 }, (_, i) => {
  const nome = `demo-${String(i + 1).padStart(4, '0')}`;
  return { valor: nome, rotulo: nome };
}).concat([{ valor: 'follow-up', rotulo: 'follow-up' }, { valor: 'visita', rotulo: 'Visita agendada' }]);

function Comigo({ opcoes = MUITAS, inicial = [] as string[] }) {
  const [escolhidas, setEscolhidas] = useState(inicial);
  return <EscolhaComBusca rotulo="Etiquetas" placeholder="Buscar etiqueta" opcoes={opcoes} escolhidas={escolhidas} aoMudar={setEscolhidas} />;
}

describe('EscolhaComBusca', () => {
  it('com poucas opções mostra todas, sem busca', () => {
    render(<Comigo opcoes={MUITAS.slice(0, 3)} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('com muitas, não mostra a lista: só o campo de busca', () => {
    render(<Comigo />);
    expect(screen.getByRole('textbox', { name: 'Buscar etiquetas' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('busca sem acento e sem caixa; no máximo 8 e avisa o resto', async () => {
    render(<Comigo />);
    await userEvent.type(screen.getByRole('textbox'), 'VISITÁ');
    expect(screen.getByRole('button', { name: 'Visita agendada' })).toBeInTheDocument();
    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.type(screen.getByRole('textbox'), 'demo');
    expect(screen.getAllByRole('button')).toHaveLength(8);
    expect(screen.getByText('Mais 22. Continue digitando para achar.')).toBeInTheDocument();
  });

  it('clicar escolhe, limpa a busca e a escolhida vai pra cima com ✕', async () => {
    render(<Comigo />);
    await userEvent.type(screen.getByRole('textbox'), 'follow');
    await userEvent.click(screen.getByRole('button', { name: 'follow-up' }));
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByRole('group', { name: 'Etiquetas escolhidas' })).toHaveTextContent('follow-up');
    await userEvent.click(screen.getByRole('button', { name: 'Tirar follow-up' }));
    expect(screen.queryByRole('group', { name: 'Etiquetas escolhidas' })).not.toBeInTheDocument();
  });

  it('Enter escolhe a primeira achada; a escolhida some das achadas', async () => {
    const aoMudar = vi.fn();
    render(<EscolhaComBusca rotulo="Etiquetas" placeholder="Buscar etiqueta" opcoes={MUITAS} escolhidas={['demo-0001']} aoMudar={aoMudar} />);
    await userEvent.type(screen.getByRole('textbox'), 'demo-000{Enter}');
    expect(aoMudar).toHaveBeenCalledWith(['demo-0001', 'demo-0002']);
  });
});
