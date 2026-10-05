// Páginas criadas no Meu site que vão para o menu do site público.
import type { SiteInfo } from '@/pages/Public/portalShared';
import { caminhoDoSite, type CtxDoSite } from './dominioDoSite';

export function menuPagesLinks(site: Pick<SiteInfo, 'menu'>, ctx: CtxDoSite): { label: string; href: string }[] {
  return (site.menu ?? [])
    .filter(p => p && p.slug)
    .map(p => ({ label: p.title, href: caminhoDoSite(ctx, `/p/${encodeURIComponent(p.slug)}`) }));
}
