import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import RedirecionaComResto from './RedirecionaComResto';

function Aqui() {
  const l = useLocation();
  return <output aria-label="aqui">{`${l.pathname}${l.search}${l.hash}`}</output>;
}

const abrir = (endereco: string) =>
  render(
    <MemoryRouter initialEntries={[endereco]}>
      <Routes>
        <Route path="/settings/lead-ads-forms" element={<RedirecionaComResto para="/automations/origem" />} />
        <Route path="/automations/origem" element={<Aqui />} />
      </Routes>
    </MemoryRouter>,
  );

describe('RedirecionaComResto', () => {
  it('leva pro destino mantendo a busca e o trecho do endereço', () => {
    abrir('/settings/lead-ads-forms?pagina=1#form');
    expect(screen.getByLabelText('aqui').textContent).toBe('/automations/origem?pagina=1#form');
  });

  it('sem busca nem trecho, vai só pro destino', () => {
    abrir('/settings/lead-ads-forms');
    expect(screen.getByLabelText('aqui').textContent).toBe('/automations/origem');
  });
});

describe('endereços antigos de Formulários do Meta', () => {
  const routes = readFileSync(resolve(__dirname, 'index.tsx'), 'utf8');
  it.each(['lead-ads-forms', '/settings/lead-ads-forms'])('%s leva pra Campanhas (/automations/origem)', (endereco) => {
    const re = new RegExp(`<Route\\s+path="${endereco}"\\s+element=\\{\\s*<RedirecionaComResto para="/automations/origem" />\\s*\\}\\s*/>`);
    expect(routes).toMatch(re);
  });
});
