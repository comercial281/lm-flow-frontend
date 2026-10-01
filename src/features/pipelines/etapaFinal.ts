/**
 * Etapa final do funil (Ganho / Perdido). Quem decide é o SERVIDOR: o campo
 * `final` de cada etapa, que olha primeiro o tipo marcado (Concluída /
 * Cancelada) e, sem tipo, o nome. O nome aqui só vale quando o servidor não
 * manda o campo (versão antiga), e é a mesma regra que os botões sempre usaram.
 */
const GANHO = /vend|ganho|ganhou|fechad/i;
const PERDA = /desqualific|perdid|perda|perdeu|descart/i;

export type TipoFinal = 'won' | 'lost';

interface EtapaComNome {
  name: string;
  final?: TipoFinal | null;
  /** Tipo marcado na etapa ('completed' = Concluída, 'cancelled' = Cancelada). */
  stage_type?: string | null;
}

export function tipoFinal(etapa: EtapaComNome): TipoFinal | null {
  if (etapa.final !== undefined) return etapa.final ?? null;
  if (PERDA.test(etapa.name)) return 'lost';
  if (GANHO.test(etapa.name)) return 'won';
  return null;
}

/**
 * A etapa marcada como Concluída ganha de uma que só "parece" ganho pelo nome,
 * mesmo vindo depois na ordem. Sem nenhuma marcada, a primeira que é ganho.
 */
export function etapaDeGanho<T extends EtapaComNome>(etapas: T[]): T | undefined {
  return etapas.find(e => e.stage_type === 'completed') ?? etapas.find(e => tipoFinal(e) === 'won');
}

/** Mesma regra do ganho: a marcada como Cancelada vem primeiro. */
export function etapaDePerda<T extends EtapaComNome>(etapas: T[]): T | undefined {
  return etapas.find(e => e.stage_type === 'cancelled') ?? etapas.find(e => tipoFinal(e) === 'lost');
}
