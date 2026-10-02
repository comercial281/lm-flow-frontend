import { telefone, toDate } from '@/lib/formato';
import { SOURCE_META } from '@/features/leadOrigin/origem';

// Regras do topo do painel do lead em Conversas. Funções puras, com spec: a tela
// só desenha o que sai daqui.

type Objeto = Record<string, unknown>;

const textoDe = (valor: unknown): string => (typeof valor === 'string' ? valor.trim() : '');

// Os rótulos da aba Origem do card têm emoji na frente (selo colorido). Na linha
// "Veio de" do painel é texto corrido: o emoji sai, o resto é o mesmo rótulo.
const semEmoji = (rotulo: string): string => rotulo.replace(/^[^\p{L}\p{N}(]+/u, '').trim();

/**
 * "Veio de": a mesma régua da aba Origem do card do lead. Primeiro a origem
 * gravada no item do funil (`lead_origin`); sem ela, o anúncio da conversa
 * (`ad_referral`). Origem não identificada ou nada: `null` (a linha não aparece).
 */
export function origemDoLead(entrada: {
  leadOrigin?: { source?: string; manual_origin?: string; [k: string]: unknown } | null;
  adReferral?: Objeto | null;
}): { rotulo: string; link: string | null } | null {
  const origem = (entrada.leadOrigin ?? null) as Objeto | null;
  const anuncio = entrada.adReferral && Object.keys(entrada.adReferral).length > 0 ? entrada.adReferral : null;
  const link = textoDe(anuncio?.source_url) || textoDe(origem?.source_url) || null;

  const source = textoDe(origem?.source);
  if (source === 'unknown') return null;

  const meta = source ? SOURCE_META[source] : undefined;
  if (meta) {
    let rotulo = semEmoji(meta.label);
    // Portal e site: o nome de qual portal/site trouxe o lead vem no próprio registro.
    const nome = source === 'portal' ? textoDe(origem?.portal) : source === 'site' ? textoDe(origem?.site) : '';
    if (nome) rotulo = `${rotulo} · ${nome}`;
    return { rotulo, link };
  }

  // Sem origem gravada (ou o espelho antigo do anúncio, gravado como "anuncio"):
  // o anúncio de onde a conversa veio.
  const doAnuncio = anuncio ?? (source === 'anuncio' ? origem : null);
  if (doAnuncio) {
    const app = textoDe(doAnuncio.source_app).toLowerCase();
    return { rotulo: app === 'instagram' ? 'Anúncio no Instagram' : 'Anúncio no Facebook', link };
  }

  return null;
}

export const OUTRO_NUMERO = 'outro número';

/**
 * "Também conversou pelo número X": a conversa mais recente do lead além da
 * aberta, e quantas outras existem além dela. A lista já vem recortada pela
 * permissão do servidor (`GET /contacts/:id/conversations`): conversa que a
 * pessoa não pode abrir nem chega aqui.
 */
export function outraConversa(
  conversas: Array<{ id: number | string; inbox?: { name?: string } | null; last_activity_at?: string | number }>,
  atualId: number | string,
): { id: string; numero: string; mais: number } | null {
  const outras = conversas.filter(c => String(c.id) !== String(atualId));
  if (outras.length === 0) return null;

  const quando = (c: (typeof outras)[number]) => toDate(c.last_activity_at)?.getTime() ?? 0;
  const maisRecente = outras.reduce((a, b) => (quando(b) > quando(a) ? b : a));

  return {
    id: String(maisRecente.id),
    numero: textoDe(maisRecente.inbox?.name) || OUTRO_NUMERO,
    mais: outras.length - 1,
  };
}

/**
 * Telefone do lead enquanto a oferta da roleta está aberta para quem vê:
 * "(11) •••••-••34", como na página de aceite. Mantém o DDD e os 2 últimos
 * dígitos. É máscara de TELA: o servidor ainda manda o número inteiro.
 */
export function mascararTelefone(telefoneCru: string | null | undefined): string | null {
  const formatado = telefone(telefoneCru);
  if (!formatado) return null;

  const comDdd = /^(\(\d{2}\) )(.*)$/.exec(formatado);
  const prefixo = comDdd ? comDdd[1] : '';
  const resto = comDdd ? comDdd[2] : formatado;

  const totalDigitos = resto.replace(/\D/g, '').length;
  let vistos = 0;
  const mascarado = resto.replace(/\d/g, digito => {
    vistos += 1;
    return vistos > totalDigitos - 2 ? digito : '•';
  });
  return `${prefixo}${mascarado}`;
}
