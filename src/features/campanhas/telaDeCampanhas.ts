/** Leitura da tela de Campanhas (Tarefa 8, 04/11/2026): só frases e recortes. Nenhuma regra de quem atende mora aqui. */
import type { ItemDeCampanha } from '@/services/campanhas/campanhasService';
import type { IgnoredLeadForm } from '@/services/leadAds/leadAdsFormsService';
import { tempoDesde } from '@/lib/formato';

/** Anúncio que não diz de que campanha veio: fica recolhido ao fim da tabela. */
export const semNomeDeCampanha = (it: Pick<ItemDeCampanha, 'kind' | 'ad_title' | 'campaign_name'>): boolean =>
  it.kind === 'ad' && !it.ad_title?.trim() && !it.campaign_name?.trim();

/** "Último lead há 3 dias". Sem data, sem frase. */
export const ultimoLeadEmTexto = (iso: string | null | undefined, agora: Date = new Date()): string | null =>
  iso ? `Último lead ${tempoDesde(iso, agora)}` : null;

const GENERICAS = new Set(['int', 'cond', 'copy', 'novo']);
/**
 * O nome da campanha limpo, pra procurar um imóvel parecido: sem a data `[03/11]`, sem símbolo, sem número solto
 * e sem etiqueta de uso. `[CASTELO 2.0]` vira `CASTELO` (o `normalizarNome` da regra por palavra apagaria o grupo inteiro).
 */
export const sugestaoPeloNome = (nome: string | null | undefined): string | null =>
  (nome ?? '')
    .replace(/\[\s*\d{1,2}\s*[/.-]\s*\d{1,2}(?:\s*[/.-]\s*\d{2,4})?\s*\]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((p) => /\p{L}/u.test(p) && !GENERICAS.has(p.toLowerCase()))
    .join(' ')
    .trim() || null;

const leads = (n: number) => `${n} ${n === 1 ? 'lead' : 'leads'}`;

const PEDE_SUPORTE = ': peça pro suporte da LM';

/**
 * O que está parado num formulário barrado. Servidor que ainda não manda `recent_count`: só a contagem,
 * sem separar o que entra sozinho do que só entra por importação.
 * `pedeSuporte`: quem não é super-admin não importa lead (o botão dá 403), então a frase da importação manda pro suporte.
 */
export function frasesDoLeadBarrado(f: Pick<IgnoredLeadForm, 'lead_count' | 'recent_count'>, pedeSuporte = false): { principal: string; porImportacao: string | null } {
  if (typeof f.recent_count !== 'number') return { principal: `${leads(f.lead_count)} esperando`, porImportacao: null };
  const velhos = Math.max(0, f.lead_count - f.recent_count);
  const sufixo = pedeSuporte ? PEDE_SUPORTE : '';
  return {
    principal: f.recent_count > 0 ? `${leads(f.recent_count)} ${f.recent_count === 1 ? 'entra sozinho' : 'entram sozinhos'} ao plugar` : `${leads(f.lead_count)} esperando`,
    porImportacao: f.recent_count > 0 && velhos > 0
      ? `${leads(velhos)} ${velhos === 1 ? 'só entra' : 'só entram'} por importação manual${sufixo}`
      : f.recent_count === 0 ? `Só entram por importação manual${sufixo}` : null,
  };
}
