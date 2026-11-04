/**
 * Agendar post do blog. O servidor (`Article.published_now`) já esconde do
 * site, da lista e do sitemap todo post publicado com data no futuro; aqui só
 * se traduz o campo da tela para isso.
 */
import type { ArticleFormData, SiteArticle } from '@/services/siteBuilder/siteBuilderService';

const dois = (n: number) => String(n).padStart(2, '0');

/** ISO do servidor → valor de <input type="datetime-local"> no fuso de quem vê. */
export function paraCampo(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/**
 * O que o campo acrescenta ao salvar. Vazio = não mexe na data nem no status
 * (mandar null apagaria a data de um post já publicado). Preenchido = publica
 * com aquela data: no futuro fica agendado, no passado sai na hora.
 */
export function camposDePublicacao(campo: string): Pick<ArticleFormData, 'status' | 'published_at'> {
  const t = campo.trim();
  if (!t) return {};
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return {};
  return { status: 'published', published_at: d.toISOString() };
}

export function estaAgendado(a: Pick<SiteArticle, 'status' | 'published_at'>, agora = new Date()): boolean {
  if (a.status !== 'published' || !a.published_at) return false;
  const d = new Date(a.published_at);
  return !Number.isNaN(d.getTime()) && d.getTime() > agora.getTime();
}
