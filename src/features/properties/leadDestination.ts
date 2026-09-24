/**
 * "Leads deste imóvel vão direto para o responsável" — a exceção por IMÓVEL.
 *
 * Pedido do dono do produto (24/09/2026): três imóveis do The House precisam
 * cair com o Bruno e dois do Collinas com o Rene. O resto dos ~900 da Mais Que
 * Imóveis continua na roleta (ou no responsável fixo) configurada no portal.
 *
 * ⚠️ A CHAVE É POR IMÓVEL, e é essa a peça central. Uma chave por cliente
 * ("lead de imóvel vai pro responsável do imóvel") redirecionaria os 900 de uma
 * vez: o campo *Corretor responsável* é cadastro desde sempre e não decidia
 * nada, então numa base grande ninguém sabe o que está gravado nele. Por imóvel,
 * cada exceção é decisão explícita de alguém.
 *
 * Mora em arquivo próprio, com teste, e não dentro da tela de Imóveis: aquele
 * arquivo tem ~2.000 linhas, e a regra que importa aqui — a chave LIGADA exige
 * responsável, senão o servidor recusa o cadastro inteiro — é invisível no JSX.
 * Mesma decisão da janela do follow-up e do banner da home.
 */

export const LEAD_DESTINATION_LABEL = 'Leads deste imóvel vão direto para o responsável';

export const LEAD_DESTINATION_HELP =
  'Ligada, o lead que chegar por este imóvel (portal ou landing de anúncio) nasce com o corretor ' +
  'responsável acima, sem passar pela roleta nem pelo destino configurado no portal. ' +
  'Desligada — que é como todo imóvel nasce —, nada muda.';

/**
 * O aviso do campo *Corretor responsável* em branco com a chave ligada.
 *
 * A porta de verdade é a validação do servidor (ele RECUSA salvar assim, com o
 * cadastro inteiro). Isto existe para a pessoa ler o motivo no segundo em que
 * liga a chave, em vez de descobrir no clique de *Salvar*.
 */
export const LEAD_DESTINATION_NEEDS_RESPONSIBLE =
  'Escolha o corretor responsável acima: sem ele, não há para quem mandar o lead deste imóvel.';

export interface LeadDestinationForm {
  lead_goes_to_responsible?: boolean;
  responsible_id?: string | null;
}

/** Ligada e sem responsável? Devolve a frase; null quando está tudo certo. */
export function leadDestinationWarning(form: LeadDestinationForm): string | null {
  if (!form.lead_goes_to_responsible) return null;
  if (String(form.responsible_id ?? '').trim()) return null;
  return LEAD_DESTINATION_NEEDS_RESPONSIBLE;
}

/**
 * Trocar o responsável NÃO desliga a chave, e apagá-lo não a desliga tampouco:
 * quem decide é a pessoa. O que a tela faz é avisar — desligar por conta
 * própria faria a chave sumir sem ninguém ver, que é o silêncio de sempre.
 */
export function leadDestinationBlocksSave(form: LeadDestinationForm): boolean {
  return leadDestinationWarning(form) !== null;
}
