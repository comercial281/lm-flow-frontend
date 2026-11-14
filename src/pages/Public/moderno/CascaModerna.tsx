import type { CSSProperties, ReactNode } from 'react';
import { PortalFooter, PortalHeader, type SiteInfo } from '../portalShared';
import type { AbaId } from '@/features/siteBuilder/public/homeConfig';

/* Casca das páginas internas do Moderno (Financiamento, Anuncie, Blog, Artigo,
   página própria): fundo, fontes, topo e rodapé do Moderno em volta do miolo.
   O `data-pagina-moderna` diz qual página é (testes e conferência). */
export default function CascaModerna({ nome, site, tenant, abas, fontHrefs, cssVars, fundo, children }: {
  nome: string; site: SiteInfo; tenant: string; abas: AbaId[];
  fontHrefs: string[]; cssVars: CSSProperties; fundo?: string; children: ReactNode;
}) {
  return (
    <div data-pagina-moderna={nome} style={cssVars} data-fundo={fundo} className="min-h-screen bg-[var(--m-ground)] text-[var(--m-text)] antialiased">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {fontHrefs.map(h => <link key={h} href={h} rel="stylesheet" />)}
      <PortalHeader site={site} tenant={tenant} abas={abas} />
      {children}
      <PortalFooter site={site} tenant={tenant} abas={abas} />
    </div>
  );
}
