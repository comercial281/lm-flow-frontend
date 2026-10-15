// Destino de aviso em grupo, na tela do CLIENTE (spec 2026-10-15).
// O servidor só devolve os grupos que este CRM pode ver; aqui só se decide o
// que mostrar. Destino gravado que o cliente não vê (ex.: o grupo interno que
// a Leal escolheu) aparece travado, sem o nome real.
export const CENTRAL_DA_LEAL = 'Operacional (LM01)';
export const ROTULO_TRAVADO = 'Grupo definido pela Leal Mídia';
export const AVISO_TRAVADO = 'Este destino foi definido pela Leal Mídia. Pra trocar, fale com a Leal.';

export type ModoDoNumero = 'proprio' | 'central';

export function modoDoNumero(instance: unknown): ModoDoNumero {
  return typeof instance === 'string' && instance.trim() ? 'central' : 'proprio';
}

export function instanciaDoModo(modo: ModoDoNumero): string {
  return modo === 'central' ? CENTRAL_DA_LEAL : '';
}

export function destinoTravado(a: {
  destino: string;
  grupos: { id: string }[];
  numerosDeUsuarios: string[];
  ehEquipe: boolean;
  carregando: boolean;
}): boolean {
  const d = a.destino.trim();
  if (!d || a.ehEquipe || a.carregando) return false;
  if (a.grupos.some(g => g.id === d)) return false;
  return !a.numerosDeUsuarios.includes(d);
}
