// Páginas criadas no Meu site que vão para o menu do site público.
import type { SiteInfo } from '@/pages/Public/portalShared';

export function menuPagesLinks(site: Pick<SiteInfo, 'menu'>, tenant: string): { label: string; href: string }[] {
  return (site.menu ?? [])
    .filter(p => p && p.slug)
    .map(p => ({ label: p.title, href: `/portal/${tenant}/p/${encodeURIComponent(p.slug)}` }));
}
