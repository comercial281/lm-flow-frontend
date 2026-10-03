import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Numeros from './Numeros';
import type { SiteDashboard } from '@/services/siteBuilder/siteBuilderService';

const base = { period_days: 30, scope: 'site', counting_since: '2026-09-20T10:00:00Z', visits: 10, visitors: 8,
  contacts: 2, conversion_rate: 20, previous: { visits: 5, visitors: 8, contacts: 4, conversion_rate: 12.5 },
  sources: [], top_properties: [], published_properties: 0 } as unknown as SiteDashboard;

describe('Numeros', () => {
  it('mostra ▲, ▼ e "igual" contra o período anterior', () => {
    render(<Numeros dash={base} />);
    expect(screen.getByText(/▲ 5/)).toBeTruthy();            // visitas 10 vs 5
    expect(screen.getByText(/▼ 2/)).toBeTruthy();            // contatos 2 vs 4
    expect(screen.getByText('igual ao período anterior')).toBeTruthy(); // pessoas 8 vs 8
    expect(screen.getByText(/▲ 7,5%/)).toBeTruthy();         // conversão em pontos
  });

  it('período anterior zerado: a subida aparece cheia', () => {
    const dash = { ...base, previous: { visits: 0, visitors: 0, contacts: 0, conversion_rate: 0 } };
    render(<Numeros dash={dash} />);
    expect(screen.getByText(/▲ 10/)).toBeTruthy();
    expect(screen.getByText(/▲ 20%/)).toBeTruthy();
  });

  it('conversão nula mostra traço e não compara', () => {
    render(<Numeros dash={{ ...base, conversion_rate: null }} />);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('sem período anterior para comparar')).toBeTruthy();
  });

  it('sem período anterior diz desde quando conta', () => {
    render(<Numeros dash={{ ...base, previous: null }} />);
    expect(screen.getAllByText(/contando desde 20\/09/).length).toBe(4);
  });
});
