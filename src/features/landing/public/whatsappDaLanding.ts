// Link do botão de WhatsApp da landing com a frase pronta.
//
// O servidor (Whatsapp::SiteReferral, backend) reconhece "Vim pela página
// <título> e quero saber mais" e trata a conversa como lead da landing: card no
// funil da página, origem "landing", aparece no "Só campanha" e entra no gatilho
// "Veio do site, LP ou portal" da IA. Sem a frase o lead chegava como conversa
// comum e sumia da caixa (12/11/2026). Mudou a frase aqui, muda lá também.
export function mensagemDaLanding(titulo: string | null | undefined): string {
  const nome = (titulo ?? '').replace(/\s+/g, ' ').trim();
  return nome ? `Olá! Vim pela página ${nome} e quero saber mais.` : 'Olá! Quero saber mais.';
}

export function linkDoWhatsappDaLanding(telefone: string, titulo: string | null | undefined): string {
  return `https://wa.me/${telefone.replace(/\D/g, '')}?text=${encodeURIComponent(mensagemDaLanding(titulo))}`;
}
