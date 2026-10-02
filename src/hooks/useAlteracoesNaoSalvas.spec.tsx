import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Link, Routes, Route } from 'react-router-dom';
import {
  useAlteracoesNaoSalvas,
  useGuardaDeSaida,
  temAlteracaoPendente,
  limparPendentes,
  mesmoConteudo,
} from './useAlteracoesNaoSalvas';
import BarraSalvar from '@/components/base/BarraSalvar';

function Tela({ sujo }: { sujo: boolean }) {
  useAlteracoesNaoSalvas(sujo);
  return <p>tela</p>;
}

function Menu() {
  const { aoClicar, dialogoDeConfirmacao } = useGuardaDeSaida();
  return (
    <nav onClickCapture={aoClicar}>
      <Link to="/outra">Outra tela</Link>
      {dialogoDeConfirmacao}
    </nav>
  );
}

function MenuComSubmenu() {
  const { aoClicar, dialogoDeConfirmacao } = useGuardaDeSaida();
  return (
    <nav onClickCapture={aoClicar}>
      <a href="/automations" data-abre-submenu="" onClick={e => e.preventDefault()}>Automações</a>
      {dialogoDeConfirmacao}
    </nav>
  );
}

function App({ sujo }: { sujo: boolean }) {
  return (
    <MemoryRouter initialEntries={['/']}>
      <Menu />
      <Routes>
        <Route path="/" element={<Tela sujo={sujo} />} />
        <Route path="/outra" element={<p>chegou na outra</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('alteração não salva', () => {
  beforeEach(() => limparPendentes());

  it('registra enquanto a tela tem alteração e limpa ao desmontar', () => {
    const { unmount, rerender } = render(<App sujo />);
    expect(temAlteracaoPendente()).toBe(true);
    rerender(<App sujo={false} />);
    expect(temAlteracaoPendente()).toBe(false);
    rerender(<App sujo />);
    unmount();
    expect(temAlteracaoPendente()).toBe(false);
  });

  it('pede confirmação do navegador ao fechar a aba só quando há alteração', () => {
    const { rerender } = render(<App sujo />);
    const evento = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(evento);
    expect(evento.defaultPrevented).toBe(true);
    rerender(<App sujo={false} />);
    const outro = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(outro);
    expect(outro.defaultPrevented).toBe(false);
  });

  it('menu sem alteração: navega direto', async () => {
    render(<App sujo={false} />);
    await userEvent.click(screen.getByText('Outra tela'));
    expect(await screen.findByText('chegou na outra')).toBeInTheDocument();
  });

  it('menu com alteração: pergunta; "Continuar editando" fica; "Sair sem salvar" vai', async () => {
    render(<App sujo />);
    await userEvent.click(screen.getByText('Outra tela'));
    expect(await screen.findByText('Sair sem salvar?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    expect(screen.queryByText('chegou na outra')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Outra tela'));
    await userEvent.click(await screen.findByRole('button', { name: 'Sair sem salvar' }));
    expect(await screen.findByText('chegou na outra')).toBeInTheDocument();
  });

  it('depois de "Sair sem salvar" o clique do link segue normal: o onClick dele roda (fecha o menu do celular)', async () => {
    const fecharMenu = vi.fn();
    function MenuDoCelular() {
      const { aoClicar, dialogoDeConfirmacao } = useGuardaDeSaida();
      return (
        <nav onClickCapture={aoClicar}>
          <Link to="/outra" onClick={fecharMenu}>Outra tela</Link>
          {dialogoDeConfirmacao}
        </nav>
      );
    }
    render(
      <MemoryRouter initialEntries={['/']}>
        <MenuDoCelular />
        <Routes>
          <Route path="/" element={<Tela sujo />} />
          <Route path="/outra" element={<p>chegou na outra</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByText('Outra tela'));
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar editando' }));
    expect(fecharMenu).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('Outra tela'));
    await userEvent.click(await screen.findByRole('button', { name: 'Sair sem salvar' }));
    expect(await screen.findByText('chegou na outra')).toBeInTheDocument();
    expect(fecharMenu).toHaveBeenCalledTimes(1);
    expect(temAlteracaoPendente()).toBe(false);
  });

  it('link que sumiu da tela enquanto o diálogo estava aberto: navega pro destino guardado', async () => {
    function MenuQueSome() {
      const { aoClicar, dialogoDeConfirmacao } = useGuardaDeSaida();
      const [aberto, setAberto] = useState(true);
      return (
        <nav onClickCapture={aoClicar}>
          {/* Como o item do popover do menu recolhido: some quando o foco vai pro diálogo. */}
          {aberto && <Link to="/outra" onMouseDown={() => setTimeout(() => setAberto(false), 0)}>Outra tela</Link>}
          {dialogoDeConfirmacao}
        </nav>
      );
    }
    render(
      <MemoryRouter initialEntries={['/']}>
        <MenuQueSome />
        <Routes>
          <Route path="/" element={<Tela sujo />} />
          <Route path="/outra" element={<p>chegou na outra</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByText('Outra tela'));
    await waitFor(() => expect(screen.queryByText('Outra tela')).not.toBeInTheDocument());
    await userEvent.click(await screen.findByRole('button', { name: 'Sair sem salvar' }));
    expect(await screen.findByText('chegou na outra')).toBeInTheDocument();
  });

  it('link que só abre submenu passa direto, mesmo com alteração', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MenuComSubmenu />
        <Routes>
          <Route path="/" element={<Tela sujo />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByText('Automações'));
    expect(screen.queryByText('Sair sem salvar?')).not.toBeInTheDocument();
  });

  it('mesmoConteudo compara o formulário com o que veio do servidor', () => {
    expect(mesmoConteudo({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true);
    expect(mesmoConteudo({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('ctrl/cmd/shift/alt-click e right-click deixam passar sem perguntar', () => {
    render(<App sujo />);
    const link = screen.getByText('Outra tela');

    // ctrl-click não deve mostrar diálogo
    fireEvent.click(link, { ctrlKey: true });
    expect(screen.queryByText('Sair sem salvar?')).not.toBeInTheDocument();

    // cmd-click não deve mostrar diálogo
    fireEvent.click(link, { metaKey: true });
    expect(screen.queryByText('Sair sem salvar?')).not.toBeInTheDocument();

    // shift-click não deve mostrar diálogo
    fireEvent.click(link, { shiftKey: true });
    expect(screen.queryByText('Sair sem salvar?')).not.toBeInTheDocument();

    // alt-click não deve mostrar diálogo
    fireEvent.click(link, { altKey: true });
    expect(screen.queryByText('Sair sem salvar?')).not.toBeInTheDocument();

    // right-click (button 2) não deve mostrar diálogo
    fireEvent.click(link, { button: 2 });
    expect(screen.queryByText('Sair sem salvar?')).not.toBeInTheDocument();
  });
});

describe('BarraSalvar', () => {
  it('some sem alteração; com alteração mostra Descartar e Salvar', async () => {
    const aoSalvar = vi.fn();
    const aoDescartar = vi.fn();
    const { rerender } = render(<BarraSalvar visivel={false} salvando={false} aoSalvar={aoSalvar} aoDescartar={aoDescartar} />);
    expect(screen.queryByRole('region', { name: 'Alterações não salvas' })).not.toBeInTheDocument();
    rerender(<BarraSalvar visivel salvando={false} aoSalvar={aoSalvar} aoDescartar={aoDescartar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(aoSalvar).toHaveBeenCalledTimes(1);
    expect(aoDescartar).toHaveBeenCalledTimes(1);
  });

  it('salvando: diz "Salvando…" e trava os dois botões', () => {
    render(<BarraSalvar visivel salvando aoSalvar={vi.fn()} aoDescartar={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeDisabled();
  });
});
