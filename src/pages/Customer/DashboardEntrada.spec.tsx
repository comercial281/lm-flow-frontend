// src/pages/Customer/DashboardEntrada.spec.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const chave = vi.hoisted(() => ({ ligada: false }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useClientToggle: (k: string) => k === 'dashboard_nova' && chave.ligada }));
vi.mock('@/pages/Customer/DashboardV2', () => ({ default: () => <div>Dashboard de hoje</div> }));
vi.mock('@/pages/Customer/DashboardNova', () => ({ default: () => <div>Dashboard nova</div> }));

import DashboardEntrada from './DashboardEntrada';

describe('DashboardEntrada', () => {
  it('chave desligada monta a Dashboard de hoje', () => {
    chave.ligada = false;
    render(<DashboardEntrada />);
    expect(screen.getByText('Dashboard de hoje')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard nova')).not.toBeInTheDocument();
  });

  it('chave ligada monta a nova', () => {
    chave.ligada = true;
    render(<DashboardEntrada />);
    expect(screen.getByText('Dashboard nova')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard de hoje')).not.toBeInTheDocument();
  });
});
