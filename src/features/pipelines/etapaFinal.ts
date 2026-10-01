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
}

export function tipoFinal(etapa: EtapaComNome): TipoFinal | null {
  if (etapa.final !== undefined) return etapa.final ?? null;
  if (PERDA.test(etapa.name)) return 'lost';
  if (GANHO.test(etapa.name)) return 'won';
  return null;
}

export function etapaDeGanho<T extends EtapaComNome>(etapas: T[]): T | undefined {
  return etapas.find(e => tipoFinal(e) === 'won');
}

export function etapaDePerda<T extends EtapaComNome>(etapas: T[]): T | undefined {
  return etapas.find(e => tipoFinal(e) === 'lost');
}
