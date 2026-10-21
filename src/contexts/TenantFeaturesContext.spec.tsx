import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TenantFeaturesProvider, useTenantFeatures } from './TenantFeaturesContext';

vi.mock('@/services/core/tenant', () => ({ getTenantSlug: () => 'demo' }));

const Sonda = () => {
  const { demoMode, loading } = useTenantFeatures();
  return <div data-testid="s">{loading ? 'carregando' : String(demoMode)}</div>;
};

const responde = (data: unknown) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data }) }));

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', 'https://api.test');
  try { localStorage.clear(); } catch { /* sem storage */ }
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('TenantFeaturesContext · demoMode', () => {
  it('lê demo_mode: true do payload público', async () => {
    responde({ features: {}, demo_mode: true });
    render(<TenantFeaturesProvider><Sonda /></TenantFeaturesProvider>);
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('true'));
  });

  it('payload sem demo_mode vira false', async () => {
    responde({ features: {} });
    render(<TenantFeaturesProvider><Sonda /></TenantFeaturesProvider>);
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('false'));
  });

  it('cache antigo sem demo_mode vira false', async () => {
    localStorage.setItem('lm_flow_tenant_features:demo', JSON.stringify({ ts: Date.now(), features: {}, archivedKeys: [] }));
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<TenantFeaturesProvider><Sonda /></TenantFeaturesProvider>);
    expect(screen.getByTestId('s').textContent).toBe('false');
  });
});
