import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AiUsageLine from './AiUsageLine';
import type { AiUsage } from '@/types/admin/clientes';

const base: AiUsage = {
  period: '2026-10', ai_leads: 3, replied: 2, runs: 5, cost_usd: 2, cost_brl: 10.92, usd_brl_rate: 5.46,
  usd_brl_source: 'accounting', usd_brl_at: null, ai_leads_included: null, overage_leads: 0,
  overage_price_brl: 0, overage_amount_brl: 0, usage_pct: null, franchise_status: 'sem_franquia',
};

describe('AiUsageLine', () => {
  it.each(['accounting', 'default'] as const)('origem %s explica o câmbio das contas', (source) => {
    render(<AiUsageLine u={{ ...base, usd_brl_source: source }} />);
    expect(screen.getByText(/custo R\$/)).toHaveAttribute('title', 'US$ 2,00 · dólar a R$ 5,46 (câmbio das contas)'.replace('US$ 2,00', 'US$ 2.00'));
  });
});
