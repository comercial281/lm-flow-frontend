// Destino de aviso em grupo, na tela do CLIENTE (spec 2026-10-15).
// O servidor só devolve os grupos que este CRM pode ver; aqui só se decide o
// que mostrar. Destino gravado que o cliente não vê (ex.: o grupo interno que
// a Leal escolheu) aparece travado, sem o nome real.
export const CENTRAL_DA_LEAL = 'Operacional (LM01)';
// Os nomes da central (o mesmo `Evolution::Central::NAMES` do servidor).
export const NOMES_DA_CENTRAL = [CENTRAL_DA_LEAL, 'Nova Instancia'];
export const ROTULO_TRAVADO = 'Grupo definido pela Leal Mídia';
// Número próprio: o servidor filtra os grupos pelo nome do CRM, então um grupo
// do próprio cliente pode não vir na lista. Não é da Leal, não trava.
export const ROTULO_FORA_DA_LISTA = 'Grupo já escolhido (não apareceu na lista)';
export const AVISO_TRAVADO = 'Este destino foi definido pela Leal Mídia. Pra trocar, fale com a Leal.';

export type ModoDoNumero = 'proprio' | 'central';

// Só nome da central é 'central'. Vazio ou outro número (ex.: um número do
// próprio cliente que a equipe escolheu) é 'proprio'.
export function modoDoNumero(instance: unknown): ModoDoNumero {
  return typeof instance === 'string' && NOMES_DA_CENTRAL.includes(instance.trim()) ? 'central' : 'proprio';
}

export function instanciaDoModo(modo: ModoDoNumero): string {
  return modo === 'central' ? CENTRAL_DA_LEAL : '';
}

// Só trava pela central: pelo número próprio o destino é do cliente.
export function destinoTravado(a: {
  destino: string;
  modo: ModoDoNumero;
  grupos: { id: string }[];
  numerosDeUsuarios: string[];
  ehEquipe: boolean;
  carregando: boolean;
}): boolean {
  const d = a.destino.trim();
  if (!d || a.modo !== 'central' || a.ehEquipe || a.carregando) return false;
  if (a.grupos.some(g => g.id === d)) return false;
  return !a.numerosDeUsuarios.includes(d);
}
