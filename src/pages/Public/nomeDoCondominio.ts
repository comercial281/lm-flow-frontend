// Linha do condomínio na página pública do imóvel. Nome que já começa com um prefixo
// ("Edifício Itália", "Residencial Jardins") não ganha "Condomínio" na frente.
// Puro e sem dependência: a página pública não carrega o resto do cadastro.

const PREFIXOS = ['condominio', 'edificio', 'residencial', 'residencia', 'conjunto'];

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function linhaDoCondominio(nome: string): string {
  const limpo = nome.trim();
  const base = semAcento(limpo);
  return PREFIXOS.some(p => base.startsWith(p)) ? limpo : `Condomínio ${limpo}`;
}
