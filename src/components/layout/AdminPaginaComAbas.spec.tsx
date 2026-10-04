import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminPaginaComAbas from './AdminPaginaComAbas';

function abrir(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route element={<AdminPaginaComAbas />}>
          <Route path="*" element={<p>conteúdo da aba</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminPaginaComAbas', () => {
  it('desenha o nome do item como título e as abas dele', () => {
    abrir('/admin/clientes/numeros');
    expect(screen.getByRole('heading', { level: 1, name: 'Clientes' })).toBeInTheDocument();
    const abas = screen.getByRole('navigation', { name: 'Abas de Clientes' });
    expect(abas).toHaveTextContent('Clientes');
    expect(abas).toHaveTextContent('Números conectados');
    expect(abas).toHaveTextContent('Custos');
    expect(screen.getByText('conteúdo da aba')).toBeInTheDocument();
  });

  it('só a aba do endereço fica ativa, mesmo quando um endereço é começo do outro', () => {
    abrir('/admin/clientes/numeros');
    expect(screen.getByRole('link', { name: 'Números conectados' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Clientes' })).not.toHaveAttribute('aria-current');
  });

  it.each([
    ['/admin/usuarios', 'Usuários'],
    ['/admin/usuarios/tenant_x/8f1c-uuid', 'Usuários'],
    ['/admin/usuarios/logs', 'Logs'],
  ])('em %s só a aba %s fica ativa', (url, ativa) => {
    abrir(url);
    expect(screen.getByRole('heading', { level: 1, name: 'Usuários' })).toBeInTheDocument();
    const abas = screen.getByRole('navigation', { name: 'Abas de Usuários' });
    for (const nome of ['Usuários', 'Logs', 'Mensagem de acesso']) {
      const link = within(abas).getByRole('link', { name: nome });
      if (nome === ativa) expect(link).toHaveAttribute('aria-current', 'page');
      else expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('item sem abas (Equipe) não ganha moldura: a tela tem o próprio título', () => {
    abrir('/admin/equipe');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByText('conteúdo da aba')).toBeInTheDocument();
  });

  it('endereço desconhecido não quebra: mostra só o conteúdo', () => {
    abrir('/admin/qualquer-coisa');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByText('conteúdo da aba')).toBeInTheDocument();
  });
});
