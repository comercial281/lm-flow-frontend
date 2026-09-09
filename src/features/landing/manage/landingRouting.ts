/**
 * O que a janela "Destino do lead" grava na landing, e como ela lê de volta.
 *
 * Mora em arquivo próprio, com teste, e não dentro da janela: o roteamento da
 * landing é o que decide para onde vai o lead que a verba de anúncio comprou, e a
 * regra mais importante daqui — MESCLAR, nunca substituir — é invisível na tela.
 * A janela conhece três coisas (o ramo do desqualificado, quem assume e o pixel),
 * e o roteamento guarda mais que isso: o destino escolhido DENTRO de cada pergunta
 * do formulário é gravado pelo editor da landing, no mesmo lugar. Enviando o bloco
 * inteiro montado do zero, abrir esta janela e salvar apagava aquilo — sem erro,
 * sem aviso, e só perceptível quando o lead parasse de cair no funil certo.
 */

/** Ramo do desqualificado: vazio significa "usa o roteamento padrão". */
export interface DisqualifiedBranch {
  pipeline_id: string | null;
  stage_id: string | null;
  label_id: string | null;
}

export interface RoutingChoice {
  /** null quando nenhum dos três campos foi preenchido. */
  disqualified: DisqualifiedBranch | null;
  /**
   * Roleta que distribui o lead desta landing. `null` = não distribui: o lead
   * entra no funil sem responsável, como toda landing sempre funcionou. É o padrão
   * e a escolha legítima de quem prefere distribuir na mão.
   */
  roletaConfigId: string | null;
}

type Settings = Record<string, unknown>;

const asRecord = (value: unknown): Settings =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Settings) : {};

/** A roleta escolhida, ou string vazia quando não há nenhuma. */
export function readRoletaConfigId(settings: unknown): string {
  const routing = asRecord(asRecord(settings).routing);
  const id = routing.roleta_config_id;
  return typeof id === 'string' ? id : '';
}

/** O ramo do desqualificado já gravado (vazio quando não há). */
export function readDisqualifiedBranch(settings: unknown): Partial<DisqualifiedBranch> {
  const routing = asRecord(asRecord(settings).routing);
  return asRecord(routing.disqualified) as Partial<DisqualifiedBranch>;
}

/**
 * O `settings` completo a enviar: o que já estava gravado, com as escolhas desta
 * janela por cima. Tudo o que ela não conhece atravessa intacto.
 */
export function buildLandingSettings(
  stored: unknown,
  choice: RoutingChoice,
  pixel: unknown,
): Settings {
  const settings = asRecord(stored);
  const routing = asRecord(settings.routing);

  return {
    ...settings,
    routing: {
      ...routing,
      disqualified: choice.disqualified ?? {},
      roleta_config_id: choice.roletaConfigId,
    },
    pixel,
  };
}
