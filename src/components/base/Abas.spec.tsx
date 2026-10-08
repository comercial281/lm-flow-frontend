import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Bell, Repeat } from 'lucide-react';
import Abas from './Abas';
import { marcarPendente, limparPendentes } from '@/hooks/useAlteracoesNaoSalvas';

const LINKS = [
  { chave: 'follow-ups', rotulo: 'Follow-up', icone: Repeat, para: '/automations/follow-ups' },
  { chave: 'lembretes', rotulo: 'Lembretes', icone: Bell, para: '/automations/whatsapp-reminders' },
];

const emRota = (inicio: string) =>
  render(
    <MemoryRouter initialEntries={[inicio]}>
      <Abas rotulo="Setores de Automações" abas={LINKS} />
      <Routes>
        <Route path="/automations/follow-ups/*" element={<p>tela follow-up</p>} />
        <Route path="/automations/whatsapp-reminders" element={<p>tela lembretes</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('Abas que são links', () => {
  beforeEach(() => limparPendentes());

  it('marca a aba da rota atual, inclusive em subrota', () => {
    emRota('/automations/follow-ups/12');
    const nav = screen.getByRole('navigation', { name: 'Setores de Automações' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Follow-up' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Lembretes' })).not.toHaveAttribute('aria-current');
  });

  it('troca de aba navega', async () => {
    emRota('/automations/follow-ups');
    await userEvent.click(screen.getByRole('link', { name: 'Lembretes' }));
    expect(await screen.findByText('tela lembretes')).toBeInTheDocument();
  });

  it('com alteração não salva, pergunta antes de trocar', async () => {
    emRota('/automations/follow-ups');
    marcarPendente('form-de-teste', true);
    await userEvent.click(screen.getByRole('link', { name: 'Lembretes' }));
    expect(await screen.findByText('Sair sem salvar?')).toBeInTheDocument();
    expect(screen.queryByText('tela lembretes')).not.toBeInTheDocument();
  });
});

describe('Abas de estado', () => {
  it('é tablist, marca a ativa e avisa a troca', async () => {
    const aoTrocar = vi.fn();
    render(
      <MemoryRouter>
        <Abas
          rotulo="Partes do lembrete"
          abas={[{ chave: 'geral', rotulo: 'Geral' }, { chave: 'mensagem', rotulo: 'Mensagem' }]}
          ativa="geral"
          aoTrocar={aoTrocar}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('tablist', { name: 'Partes do lembrete' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Geral' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Mensagem' }));
    expect(aoTrocar).toHaveBeenCalledWith('mensagem');
  });
});

describe('bolinha de novidade', () => {
  it('aparece só na aba marcada (aba de estado)', () => {
    render(
      <MemoryRouter>
        <Abas rotulo="Partes" ativa="a" aoTrocar={() => {}}
          abas={[{ chave: 'a', rotulo: 'Uma' }, { chave: 'b', rotulo: 'Outra', marcador: true }]} />
      </MemoryRouter>,
    );
    expect(screen.queryAllByLabelText('Novidade')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: /Outra/ })).toContainElement(screen.getByLabelText('Novidade'));
  });

  it('aparece também na aba que é link', () => {
    render(
      <MemoryRouter initialEntries={['/automations/follow-ups']}>
        <Abas rotulo="Setores" abas={[LINKS[0], { ...LINKS[1], marcador: true }]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Lembretes/ })).toContainElement(screen.getByLabelText('Novidade'));
  });
});

describe('Abas com contagem', () => {
  it('o número aparece ao lado do nome, no formato brasileiro, e entra no nome da aba', async () => {
    const aoTrocar = vi.fn();
    render(
      <MemoryRouter>
        <Abas
          rotulo="Situação dos leads"
          ativa="abertos"
          aoTrocar={aoTrocar}
          abas={[
            { chave: 'abertos', rotulo: 'Abertos', contagem: 2800 },
            { chave: 'ganhos', rotulo: 'Ganhos', contagem: 0 },
            { chave: 'todos', rotulo: 'Todos' },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('tab', { name: 'Abertos 2.800' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Ganhos 0' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Todos' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Ganhos 0' }));
    expect(aoTrocar).toHaveBeenCalledWith('ganhos');
  });
});
