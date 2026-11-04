// BLOCO RANDOMIZADOR (04/11/2026): sorteia um caminho pra cada lead, conforme a %
// de cada um. Os caminhos moram em `config.branches`, com a ligação em cada um
// (o número de saídas varia, então não cabe nas colunas de ligação do bloco).
// O nome do caminho é a posição na lista: quem liga a linha é o `id`.

import { plural } from '@/lib/formato';
import type { FlowAutomationNode, FlowNodeConfig } from '@/types/flowAutomations';

export interface RandomBranch {
  id: string;
  percent: number;
  next_node_id: string | null;
}

export const MIN_BRANCHES = 2;
export const MAX_BRANCHES = 10;

export function branchesOf(config: FlowNodeConfig | null | undefined): RandomBranch[] {
  const raw = config?.branches;
  if (!Array.isArray(raw)) return [];
  return raw.map(item => {
    const branch = item as Partial<RandomBranch>;
    return { id: String(branch.id ?? ''), percent: Number(branch.percent) || 0, next_node_id: branch.next_node_id ?? null };
  });
}

const withBranches = (config: FlowNodeConfig, branches: RandomBranch[]): FlowNodeConfig => ({ ...config, branches });

/** A letra do caminho na tela: A, B, C… */
export function branchLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/** A divisão igual fecha 100%: a sobra da conta fica nos primeiros (34, 33, 33). */
export function splitEvenly<T extends object>(branches: T[]): Array<T & { percent: number }> {
  const base = Math.floor(100 / branches.length);
  const leftover = 100 - base * branches.length;
  return branches.map((branch, index) => ({ ...branch, percent: base + (index < leftover ? 1 : 0) }));
}

export function addBranch(config: FlowNodeConfig): FlowNodeConfig {
  const branches = branchesOf(config);
  if (branches.length >= MAX_BRANCHES) return config;
  return withBranches(config, splitEvenly([...branches, { id: crypto.randomUUID(), percent: 0, next_node_id: null }]));
}

export function removeBranch(config: FlowNodeConfig, id: string): FlowNodeConfig {
  const branches = branchesOf(config);
  if (branches.length <= MIN_BRANCHES) return config;
  return withBranches(config, splitEvenly(branches.filter(branch => branch.id !== id)));
}

export function splitConfigEvenly(config: FlowNodeConfig): FlowNodeConfig {
  return withBranches(config, splitEvenly(branchesOf(config)));
}

/** A % digitada: inteiro de 0 a 100. Não mexe nos outros caminhos. */
export function setBranchPercent(config: FlowNodeConfig, id: string, value: string): FlowNodeConfig {
  const percent = Math.min(100, Math.max(0, Math.trunc(Number(value)) || 0));
  return withBranches(config, branchesOf(config).map(branch => (branch.id === id ? { ...branch, percent } : branch)));
}

export function percentTotal(config: FlowNodeConfig): number {
  return branchesOf(config).reduce((total, branch) => total + branch.percent, 0);
}

export function percentProblem(config: FlowNodeConfig): string | null {
  const total = percentTotal(config);
  if (total === 100) return null;
  return total < 100 ? `Faltam ${100 - total}% pra fechar 100%.` : `Passou ${total - 100}% dos 100%.`;
}

export function summary(config: FlowNodeConfig): string {
  return `Sorteia 1 de ${plural(branchesOf(config).length, 'caminho', 'caminhos')} pra cada lead.`;
}

/** Troca a ligação de cada caminho do bloco; os outros tipos de bloco voltam iguais. */
export function mapBranchTargets<T extends Pick<FlowAutomationNode, 'kind' | 'config'>>(
  node: T,
  next: (target: string | null) => string | null,
): T {
  if (node.kind !== 'randomizer') return node;
  const branches = branchesOf(node.config).map(branch => ({ ...branch, next_node_id: next(branch.next_node_id) }));
  return { ...node, config: withBranches(node.config, branches) };
}
