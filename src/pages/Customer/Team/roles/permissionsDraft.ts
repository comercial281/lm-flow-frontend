import type { CapabilityState } from '@/types/customRoles';

/* Rascunho da aba Permissões: só guarda o que a pessoa MUDOU em relação ao que
   o servidor mostra. `{ [cargo]: { [linha]: ligado? } }`. Guardar apenas a
   diferença faz "Desfazer" ser limpar o objeto e deixa a contagem de mudanças
   honesta (ligar e desligar de volta não conta). */
export type PermissionsDraft = Record<number, Record<string, boolean>>;

/** Estado que a célula mostra: o do rascunho, se houver, senão o do servidor. */
export function effectiveState(
  draft: PermissionsDraft,
  roleId: number,
  rowKey: string,
  current: CapabilityState,
): CapabilityState {
  const v = draft[roleId]?.[rowKey];
  if (v === undefined) return current;
  return v ? 'on' : 'off';
}

/** Clique numa célula. Parcial vira ligado; ligado vira desligado; desligado vira ligado.
 *  Voltar ao valor do servidor tira a linha do rascunho. */
export function toggle(
  draft: PermissionsDraft,
  roleId: number,
  rowKey: string,
  current: CapabilityState,
): PermissionsDraft {
  const next = effectiveState(draft, roleId, rowKey, current) !== 'on';
  const sameAsServer = (current === 'on' && next) || (current === 'off' && !next);
  const role = { ...(draft[roleId] ?? {}) };
  if (sameAsServer) delete role[rowKey];
  else role[rowKey] = next;
  const out = { ...draft };
  if (Object.keys(role).length === 0) delete out[roleId];
  else out[roleId] = role;
  return out;
}

export function countChanges(draft: PermissionsDraft): number {
  return Object.values(draft).reduce((n, r) => n + Object.keys(r).length, 0);
}

/** Um item por cargo com mudança, só com as linhas dele (é o que o servidor recebe). */
export function changesByRole(draft: PermissionsDraft): Array<{ roleId: number; changes: Record<string, boolean> }> {
  return Object.entries(draft)
    .filter(([, c]) => Object.keys(c).length > 0)
    .map(([id, changes]) => ({ roleId: Number(id), changes: { ...changes } }));
}

/** Tira o rascunho de um cargo (depois de salvar com sucesso). */
export function clearRole(draft: PermissionsDraft, roleId: number): PermissionsDraft {
  const out = { ...draft };
  delete out[roleId];
  return out;
}

/** Tira do rascunho as linhas que `drop` manda soltar (ex.: ficaram travadas pelo pai depois
 *  de recarregar). Devolve o MESMO objeto quando nada sai, pra não render à toa. */
export function dropEntries(draft: PermissionsDraft, drop: (roleId: number, rowKey: string) => boolean): PermissionsDraft {
  let changed = false;
  const out: PermissionsDraft = {};
  for (const [id, rows] of Object.entries(draft)) {
    const kept = Object.fromEntries(Object.entries(rows).filter(([k]) => !drop(Number(id), k)));
    if (Object.keys(kept).length !== Object.keys(rows).length) changed = true;
    if (Object.keys(kept).length > 0) out[Number(id)] = kept;
  }
  return changed ? out : draft;
}
