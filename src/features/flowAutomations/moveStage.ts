// BLOCO "MOVER DE ETAPA" (sprint 1; sprint 3 acrescenta o nome da coluna).
//
// Duas formas, uma de cada vez na config:
//   - `stage_id`: uma etapa específica, de um funil escolhido;
//   - `stage_name`: "coluna com este nome no funil do card". O servidor procura,
//     no funil em que o card do lead está, a coluna com esse nome (sem ligar pra
//     acento e maiúscula), como o follow-up antigo fazia com a coluna de resposta.
//     Serve pro mesmo fluxo atender leads de funis diferentes.

import type { FlowNodeConfig } from '@/types/flowAutomations';

export type MoveStageMode = 'stage' | 'name';

// Os modelos da sprint 2 gravavam `stage_slug` (bug do _MELHORIAS de 02/10).
// A tela mostra o slug como nome; salvar a janela grava `stage_name`.
export function moveStageModeOf(config: FlowNodeConfig | null | undefined): MoveStageMode {
  if (config?.stage_id) return 'stage';
  return typeof config?.stage_name === 'string' || typeof config?.stage_slug === 'string' ? 'name' : 'stage';
}

/** O nome da coluna (ou o slug antigo, que vale como nome). */
export function stageNameOf(config: FlowNodeConfig | null | undefined): string {
  return String(config?.stage_name ?? config?.stage_slug ?? '');
}

/** Troca a forma: a chave da outra sai, pra o servidor nunca ler as duas. */
export function withMoveStageMode(config: FlowNodeConfig, mode: MoveStageMode): FlowNodeConfig {
  const { stage_id: _id, stage_name: _name, stage_slug: _slug, ...rest } = config;
  return mode === 'name' ? { ...rest, stage_name: stageNameOf(config) } : { ...rest, stage_id: String(config.stage_id ?? '') };
}

export function withStageName(config: FlowNodeConfig, name: string): FlowNodeConfig {
  const { stage_id: _id, stage_slug: _slug, ...rest } = config;
  return { ...rest, stage_name: name };
}

/**
 * O motor lê `stage_id` ou `stage_name`; o `stage_slug` dos modelos antigos ele
 * NÃO lê. Bloco só com o slug pede pra abrir e salvar (a janela grava como nome).
 */
export function moveStageProblem(config: FlowNodeConfig | null | undefined): string | null {
  if (moveStageModeOf(config) === 'name') {
    if (typeof config?.stage_name !== 'string') return 'Abra o bloco e confirme o nome da coluna.';
    return config.stage_name.trim() ? null : 'Escreva o nome da coluna.';
  }
  return config?.stage_id ? null : 'Escolha a etapa.';
}
