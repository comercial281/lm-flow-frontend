import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIMULATOR_RULES,
  computeSimulation,
  simulatorRulesSchema,
} from './engine';

describe('simulator engine (cálculo real de financiamento)', () => {
  it('defaults: 30% renda, 10,5% a.a., 360 meses', () => {
    expect(DEFAULT_SIMULATOR_RULES).toMatchObject({
      incomeCommitmentPct: 0.3,
      annualInterestRate: 0.105,
      maxTermMonths: 360,
      recommendProperties: true,
    });
  });

  it('renda 8.000 + entrada 40.000 → parcela 2.400 e imóvel ~R$ 312k', () => {
    const r = computeSimulation({ monthlyIncome: 8000, downPayment: 40000 });
    expect(r.maxInstallment).toBe(2400); // 30% de 8000
    // Price PV de 2400/mês, 360 meses, ~10,5% a.a.
    expect(r.financiableAmount).toBeGreaterThan(268_000);
    expect(r.financiableAmount).toBeLessThan(278_000);
    expect(r.maxPropertyValue).toBeGreaterThan(308_000);
    expect(r.maxPropertyValue).toBeLessThan(318_000);
    expect(r.diagnosis).toMatch(/apto a um imóvel de até R\$/);
  });

  it('renda maior → financia mais (monotônico)', () => {
    const a = computeSimulation({ monthlyIncome: 5000, downPayment: 0 });
    const b = computeSimulation({ monthlyIncome: 12000, downPayment: 0 });
    expect(b.maxPropertyValue).toBeGreaterThan(a.maxPropertyValue);
  });

  it('regras editáveis: % da renda maior aumenta o alcance', () => {
    const base = computeSimulation({ monthlyIncome: 8000, downPayment: 0 });
    const loose = computeSimulation(
      { monthlyIncome: 8000, downPayment: 0 },
      { ...DEFAULT_SIMULATOR_RULES, incomeCommitmentPct: 0.4 },
    );
    expect(loose.maxPropertyValue).toBeGreaterThan(base.maxPropertyValue);
  });

  it('toggle recommend=false propaga no resultado (cliente só divulga o imóvel)', () => {
    const r = computeSimulation(
      { monthlyIncome: 8000, downPayment: 0 },
      { ...DEFAULT_SIMULATOR_RULES, recommendProperties: false },
    );
    expect(r.recommend).toBe(false);
  });

  it('temperatura: crédito aprovado + entrada + valor alto = quente', () => {
    const r = computeSimulation({
      monthlyIncome: 12000,
      downPayment: 60000,
      readiness: 'credit_approved',
    });
    expect(r.temperature).toBe('hot');
  });

  it('renda 0 → sem alcance, frio, pede a renda', () => {
    const r = computeSimulation({ monthlyIncome: 0, downPayment: 0 });
    expect(r.maxPropertyValue).toBe(0);
    expect(r.temperature).toBe('cold');
    expect(r.diagnosis).toMatch(/Informe sua renda/);
  });

  it('rules inválidas são normalizadas pelo schema', () => {
    const parsed = simulatorRulesSchema.parse({ incomeCommitmentPct: 0.35 });
    expect(parsed.annualInterestRate).toBe(0.105); // default preenchido
  });
});
