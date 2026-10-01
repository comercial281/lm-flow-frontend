import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ComAbaAntiga, RedirecionaComBusca } from './AdminRedirecionamentos';

function Onde() {
  const { pathname, search } = useLocation();
  return <p>{`${pathname}${search}`}</p>;
}

describe('RedirecionaComBusca', () => {
  it('leva /admin/uso?client=x para /admin/usuarios?client=x', () => {
    render(
      <MemoryRouter initialEntries={['/admin/uso?client=pinot']}>
        <Routes>
          <Route path="/admin/uso" element={<RedirecionaComBusca para="/admin/usuarios" />} />
          <Route path="/admin/usuarios" element={<Onde />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('/admin/usuarios?client=pinot')).toBeInTheDocument();
  });
});

describe('ComAbaAntiga', () => {
  it('?tab=leads-ao-vivo em Clientes vai para Leads ao vivo', () => {
    render(
      <MemoryRouter initialEntries={['/admin/clientes?tab=leads-ao-vivo']}>
        <Routes>
          <Route path="/admin/clientes" element={<ComAbaAntiga base="/admin/clientes"><p>lista</p></ComAbaAntiga>} />
          <Route path="/admin/leads-ao-vivo" element={<Onde />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('/admin/leads-ao-vivo')).toBeInTheDocument();
  });

  it('sem ?tab mostra a tela', () => {
    render(
      <MemoryRouter initialEntries={['/admin/agentes']}>
        <Routes>
          <Route path="/admin/agentes" element={<ComAbaAntiga base="/admin/agentes"><p>agentes</p></ComAbaAntiga>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('agentes')).toBeInTheDocument();
  });
});
