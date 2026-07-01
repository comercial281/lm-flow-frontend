import { z } from 'zod';

/**
 * Real financing simulation engine — the honest core behind the gamified quiz.
 * Given the lead's answers + the (configurable) rules, it computes a genuine
 * simplified pre-approval: parcela that fits the income, amount a bank would
 * finance, and the property value the lead can reach.
 *
 * Math: standard Price-table present value of an annuity.
 *   financiable = parcela * (1 - (1+i)^-n) / i      (i>0)
 * with i = effective monthly rate derived from the annual rate.
 */

export const simulatorRulesSchema = z.object({
  /** Share of monthly income a bank lets the installment take (default 30%). */
  incomeCommitmentPct: z.number().min(0.05).max(1).default(0.3),
  /** Effective annual interest rate (default 10.5% a.a.). */
  annualInterestRate: z.number().min(0).max(1).default(0.105),
  /** Max financing term in months (default 360 = 30 years). */
  maxTermMonths: z.number().int().min(1).max(600).default(360),
  /** Recommend catalog properties that fit the budget. OFF = only this imóvel. */
  recommendProperties: z.boolean().default(true),
});

export type SimulatorRules = z.infer<typeof simulatorRulesSchema>;

export const DEFAULT_SIMULATOR_RULES: SimulatorRules = simulatorRulesSchema.parse({});

export type Purpose = 'live' | 'invest';
/** How ready the lead is to buy. */
export type Readiness = 'credit_approved' | 'soon' | 'researching';

export interface SimulatorAnswers {
  monthlyIncome: number;
  downPayment: number;
  purpose?: Purpose;
  readiness?: Readiness;
}

export type Temperature = 'hot' | 'warm' | 'cold';

export interface SimulationResult {
  /** Max installment that fits the income. */
  maxInstallment: number;
  /** Amount a bank would finance for that installment/term/rate. */
  financiableAmount: number;
  /** Property value the lead reaches = financiable + down payment. */
  maxPropertyValue: number;
  termMonths: number;
  /** Effective monthly rate used. */
  monthlyRate: number;
  /** Whether to show recommended catalog properties (from the toggle). */
  recommend: boolean;
  temperature: Temperature;
  /** Human diagnosis line, e.g. "Você está apto a um imóvel de até R$ 312.000". */
  diagnosis: string;
}

/** Effective monthly rate from an effective annual rate. */
export function monthlyRateFromAnnual(annual: number): number {
  return Math.pow(1 + annual, 1 / 12) - 1;
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function scoreTemperature(answers: SimulatorAnswers, maxPropertyValue: number): Temperature {
  let points = 0;
  if (answers.readiness === 'credit_approved') points += 3;
  else if (answers.readiness === 'soon') points += 2;
  else if (answers.readiness === 'researching') points += 0;
  if (answers.downPayment > 0) points += 1;
  if (maxPropertyValue >= 200_000) points += 1;
  if (points >= 4) return 'hot';
  if (points >= 2) return 'warm';
  return 'cold';
}

export function computeSimulation(
  answers: SimulatorAnswers,
  rules: SimulatorRules = DEFAULT_SIMULATOR_RULES,
): SimulationResult {
  const income = Math.max(0, answers.monthlyIncome || 0);
  const down = Math.max(0, answers.downPayment || 0);
  const n = rules.maxTermMonths;
  const i = monthlyRateFromAnnual(rules.annualInterestRate);

  const maxInstallment = income * rules.incomeCommitmentPct;
  const financiableAmount =
    i > 0 ? maxInstallment * ((1 - Math.pow(1 + i, -n)) / i) : maxInstallment * n;
  const maxPropertyValue = financiableAmount + down;

  const temperature = scoreTemperature(answers, maxPropertyValue);
  const diagnosis =
    maxPropertyValue > 0
      ? `Você está apto a um imóvel de até ${formatBRL(maxPropertyValue)}`
      : 'Informe sua renda para ver a que imóvel você tem acesso';

  return {
    maxInstallment: Math.round(maxInstallment),
    financiableAmount: Math.round(financiableAmount),
    maxPropertyValue: Math.round(maxPropertyValue),
    termMonths: n,
    monthlyRate: i,
    recommend: rules.recommendProperties,
    temperature,
    diagnosis,
  };
}
