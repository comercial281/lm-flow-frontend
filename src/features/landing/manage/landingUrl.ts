/**
 * Endereço público da landing e conversão do nome em endereço.
 *
 * Vive num arquivo só porque é a string que vai COLADA num anúncio pago: o
 * editor, a lista e o assistente precisam mostrar exatamente o mesmo resultado.
 * Duas cópias divergindo aqui significam o cliente copiar um link que não abre.
 */
import { enderecoDaLanding } from '@/features/landing/public/enderecoDaLanding';

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

/**
 * Endereço público hospedado pela Leal Mídia (não depende de domínio do cliente).
 *
 * Sempre no endereço do próprio cliente (`<cliente>.lmflow.com.br`), que é onde
 * a landing abre (ver `enderecoDaLanding.ts`). Aberto no endereço do cliente,
 * sai igual a antes; aberto em outro endereço lmflow, sai o do cliente direto,
 * sem passar pelo redirecionamento.
 */
export function landingPublicUrl(
  tenant: string,
  slug: string,
  local: Pick<Location, 'hostname' | 'origin'> = window.location,
): string {
  const caminho = `/lp/${tenant}/${slug}`;
  const endereco = enderecoDaLanding({ hostname: local.hostname, pathname: caminho }, tenant);
  return endereco.tipo === 'redirecionar' ? endereco.url : `${local.origin}${caminho}`;
}
