import { BaseHeader, Pagina } from '@/components/base';

// Esqueleto da tela. A lista de páginas entra na Task 8.
export default function SitesELandingPages() {
  return (
    <Pagina
      cabecalho={
        <BaseHeader
          title="Sites e landing pages"
          subtitle="Cada página ganha um endereço próprio. Quem preencher o formulário entra no funil e com o corretor que você escolher."
        />
      }
    >
      {null}
    </Pagina>
  );
}
