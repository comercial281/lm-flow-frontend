/**
 * CRECI no site público. Todo anúncio de imóvel precisa do número de
 * inscrição (Lei 6.530/78, Resolução COFECI 1.065/2007).
 * - Da imobiliária: `site.creci` (Configurações › Conta; reserva: o antigo do
 *   Meu site › Google). Vai no rodapé e no quadro de contato da ficha.
 * - De quem atende: `responsible_creci` ("12345-F/SP"), ao lado do nome.
 * Sem número, nada aparece (servidor antigo também não manda).
 */
export function linhaDoCreci(creci?: string | null): string | null {
  const numero = creci?.trim();
  return numero ? `CRECI ${numero}` : null;
}

export function linhaDoAtendimento(nome?: string | null, creci?: string | null): string | null {
  const quem = nome?.trim();
  if (!quem) return null;
  const numero = linhaDoCreci(creci);
  return numero ? `Atendimento: ${quem} · ${numero}` : `Atendimento: ${quem}`;
}
