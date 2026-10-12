// Quem vê o quê na Área de Membros (decisão do Tony, 12/10/2026).
// A trava é de TELA: o conteúdo continua legível pela chave pública. Serve pra
// treinamento, não pra segredo.

import type { KnowledgeLesson, KnowledgeModule, QuemAssiste } from '@/hooks/useKnowledge';

export type { QuemAssiste };

/** admin = Leal Mídia montando (ou sem "Ver como"); gestor = vê a equipe toda; corretor = o resto. */
export type CargoNaAcademia = 'admin' | 'gestor' | 'corretor';

export function quemAssiste(m: { audience?: string | null }): QuemAssiste {
  return m.audience === 'managers' ? 'managers' : 'all';
}

export function podeAssistir(m: { audience?: string | null }, cargo: CargoNaAcademia): boolean {
  return quemAssiste(m) === 'all' || cargo !== 'corretor';
}

export function agruparAulas(aulas: KnowledgeLesson[]): Record<string, KnowledgeLesson[]> {
  const mapa: Record<string, KnowledgeLesson[]> = {};
  for (const l of aulas) (mapa[l.module_id] ??= []).push(l);
  for (const k of Object.keys(mapa)) mapa[k].sort((a, b) => a.ordem - b.ordem);
  return mapa;
}

/**
 * O que aparece pra quem assiste: tira o módulo de gestor (corretor) e o módulo
 * sem aula (menos pra Leal Mídia montando). Com as aulas ainda carregando, não
 * tira o vazio: senão a tela piscaria "Nenhum curso" antes de as aulas chegarem.
 */
export function modulosVisiveis(
  modulos: KnowledgeModule[],
  aulasPorModulo: Record<string, KnowledgeLesson[]>,
  cargo: CargoNaAcademia,
  aulasCarregadas: boolean,
): KnowledgeModule[] {
  return modulos.filter((m) => {
    if (!podeAssistir(m, cargo)) return false;
    if (cargo === 'admin' || !aulasCarregadas) return true;
    return (aulasPorModulo[m.id]?.length ?? 0) > 0;
  });
}

export function contarAulas(
  modulos: KnowledgeModule[],
  aulasPorModulo: Record<string, KnowledgeLesson[]>,
  progresso: Record<string, boolean>,
): { total: number; feitas: number; minutos: number } {
  let total = 0;
  let feitas = 0;
  let minutos = 0;
  for (const m of modulos) {
    for (const l of aulasPorModulo[m.id] ?? []) {
      total += 1;
      minutos += l.duracao_min ?? 0;
      if (progresso[l.id]) feitas += 1;
    }
  }
  return { total, feitas, minutos };
}

/** Curso (ou grupo de módulos) em que tudo é só pra gestores: ganha o selo no cartão. */
export function soParaGestores(modulos: { audience?: string | null }[]): boolean {
  return modulos.length > 0 && modulos.every((m) => quemAssiste(m) === 'managers');
}
