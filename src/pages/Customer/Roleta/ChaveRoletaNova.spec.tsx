import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';

const chaves = vi.hoisted(() => ({ features: {} as Record<string, boolean>, loading: false }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({
  useClientToggle: (k: string) => chaves.features[k] === true,
  useTenantFeatures: () => ({ features: chaves.features, loading: chaves.loading }),
}));
import ChaveRoletaNova from './ChaveRoletaNova';

beforeEach(() => { chaves.features = {}; chaves.loading = false; });

const rotas = (endereco: string) => render(
  <MemoryRouter initialEntries={[endereco]}>
    <Routes>
      <Route path="/automations/roleta-config" element={<ChaveRoletaNova ligada={<p>lista nova</p>} desligada={<p>tela antiga</p>} />} />
      <Route
        path="/automations/roleta-config/:id"
        element={<ChaveRoletaNova ligada={<p>página da roleta</p>} desligada={<Navigate to="/automations/roleta-config" replace />} />}
      />
    </Routes>
  </MemoryRouter>,
);

describe('portão da roleta nova', () => {
  it('chave desligada (ou ausente): a tela antiga, intacta', () => {
    rotas('/automations/roleta-config');
    expect(screen.getByText('tela antiga')).toBeInTheDocument();
  });

  it('chave ligada: a lista nova', () => {
    chaves.features = { roleta_nova: true };
    rotas('/automations/roleta-config');
    expect(screen.getByText('lista nova')).toBeInTheDocument();
  });

  it('página da roleta sem a chave volta pra lista (a antiga)', () => {
    rotas('/automations/roleta-config/r1');
    expect(screen.getByText('tela antiga')).toBeInTheDocument();
  });

  it('página da roleta com a chave', () => {
    chaves.features = { roleta_nova: true };
    rotas('/automations/roleta-config/r1');
    expect(screen.getByText('página da roleta')).toBeInTheDocument();
  });

  it('enquanto as chaves carregam, não decide (nem a antiga pisca)', () => {
    chaves.loading = true;
    rotas('/automations/roleta-config');
    expect(screen.queryByText('tela antiga')).toBeNull();
    expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument();
  });
});
