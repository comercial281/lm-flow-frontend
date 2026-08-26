/**
 * Endereço público da landing e conversão do nome em endereço.
 *
 * Vive num arquivo só porque é a string que vai COLADA num anúncio pago: o
 * editor, a lista e o assistente precisam mostrar exatamente o mesmo resultado.
 * Duas cópias divergindo aqui significam o cliente copiar um link que não abre.
 */

/**
 * Nome digitado -> pedaço final do endereço.
 *
 * O intervalo de acentos é escrito como \u0300-\u036f de propósito: a
 * versão anterior trazia os caracteres combinantes literais no fonte, que
 * qualquer normalização de editor ou correção automática de lint apagava em
 * silêncio — e aí o endereço saía com acento quebrado.
 */
export function slugifyLandingName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Endereço público hospedado pela Leal Mídia (não depende de domínio do cliente). */
export function landingPublicUrl(tenant: string, slug: string): string {
  return `${window.location.origin}/lp/${tenant}/${slug}`;
}
