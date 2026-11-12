// Link do botão de WhatsApp da landing com a frase pronta.
//
// O servidor (Whatsapp::SiteReferral, backend) reconhece "Vim pela página
// <endereço> e quero saber mais" e trata a conversa como lead da landing: card no
// funil da página, origem "landing", aparece no "Só campanha" e entra no gatilho
// "Veio do site, LP ou portal" da IA. Sem a frase o lead chegava como conversa
// comum e sumia da caixa (12/11/2026). Mudou a frase aqui, muda lá também.
//
// Vai o ENDEREÇO (slug) da página, não o nome: o nome é de bastidor ("LP BF v2")
// e pode repetir entre páginas; o endereço o lead já vê na barra do navegador,
// é único no site e não muda quando renomeiam a página.
export function mensagemDaLanding(slug: string | null | undefined): string {
  const endereco = (slug ?? '').trim();
  return endereco ? `Olá! Vim pela página ${endereco} e quero saber mais.` : 'Olá! Quero saber mais.';
}

export function linkDoWhatsappDaLanding(telefone: string, slug: string | null | undefined): string {
  return `https://wa.me/${telefone.replace(/\D/g, '')}?text=${encodeURIComponent(mensagemDaLanding(slug))}`;
}
