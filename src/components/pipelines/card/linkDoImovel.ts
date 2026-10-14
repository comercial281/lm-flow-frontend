// Pra onde o "Abrir" do imóvel de interesse leva: quem pode editar vai pro
// cadastro; quem não pode cai na lista já filtrada pelo código.
export function linkDoImovel(p: { id: string; code: string }, podeEditar: boolean): string {
  return podeEditar ? `/properties/${p.id}/editar` : `/properties?q=${encodeURIComponent(p.code)}`;
}
