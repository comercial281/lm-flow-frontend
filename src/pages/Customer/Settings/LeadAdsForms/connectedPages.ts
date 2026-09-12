import type { MetaPage } from '@/services/integrations/metaPagesService';
import type { MetaForm } from '@/services/leadAds/leadAdsFormsService';

export interface PageOption {
  id: string;
  name: string;
}

// As páginas que o filtro da tela de Formulários oferece.
//
// Antes a lista era derivada dos formulários SINCRONIZADOS: página conectada com
// zero formulários, ou com o token falhando, simplesmente não aparecia — e
// "conectei a página B e não vejo nada" era indistinguível de "a página B não
// está conectada". A fonte de verdade é a lista de páginas conectadas (ativas);
// as que só aparecem em formulários entram depois, para o cliente legado sem a
// tabela de páginas (ali `metaPages` vem vazio e os formulários são tudo que há).
export function connectedPagesFrom(metaPages: MetaPage[], metaForms: MetaForm[]): PageOption[] {
  const byId = new Map<string, string>();

  for (const page of metaPages) {
    if (!page.is_active) continue;
    byId.set(page.id, page.page_name || page.page_id || 'Página');
  }

  for (const form of metaForms) {
    if (!form.meta_page_id || byId.has(form.meta_page_id)) continue;
    byId.set(form.meta_page_id, form.page_name || form.page_id || 'Página');
  }

  return Array.from(byId.entries()).map(([id, name]) => ({ id, name }));
}
