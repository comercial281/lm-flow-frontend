import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import RedirecionaAssistente from './RedirecionaAssistente';

function Destino() {
  const l = useLocation();
  return <p data-testid="destino">{l.pathname}{l.search}</p>;
}

describe('RedirecionaAssistente', () => {
  it('o assistente antigo abre o passo 1 da mesma IA', () => {
    render(
      <MemoryRouter initialEntries={['/ia-vendedora/ia-7/assistente']}>
        <Routes>
          <Route path="/ia-vendedora/:id/assistente" element={<RedirecionaAssistente />} />
          <Route path="/ia-vendedora" element={<Destino />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('destino').textContent).toBe('/ia-vendedora?ia=ia-7&tela=configurar&passo=1');
  });
});
