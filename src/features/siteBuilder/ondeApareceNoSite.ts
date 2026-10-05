// Onde cada contato aparece no site, pela Aparência (C3). As telas Dados de
// contato e Redes sociais usam estas frases como ajuda: a frase de ajuda tem
// que bater com o que o site faz, e o rodapé compacto e a faixa de cima mudam
// isso.
//
// O que o site faz (`portalShared.tsx`):
// - rodapé em colunas: telefone, e-mail, endereço e o NOME de cada rede;
// - rodapé compacto: logo, links, WhatsApp, frase e crédito (nenhum dos quatro);
// - faixa de cima (só no computador, fora da página inicial):
//   `two_phones` telefone, e-mail e o nome das redes; `one_phone` o telefone (o
//   e-mail só quando não há telefone) e o nome das redes; `icons` os mesmos,
//   só o ícone; `hidden` nada;
// - a página de manutenção mostra WhatsApp, telefone e e-mail.
import { APARENCIA_FABRICA, type Aparencia } from './public/aparenciaConfig';

const FAIXA = 'no computador, na faixa de cima das páginas internas';

/** Ajuda do telefone ou do e-mail. */
export function ondeApareceContato(apOuNada: Aparencia | undefined, contato: 'telefone' | 'email'): string {
  const ap = apOuNada ?? APARENCIA_FABRICA;
  const rodape = ap.footer_layout === 'columns';
  const faixa = ap.top_bar !== 'hidden';
  const detalhe = [
    ap.top_bar === 'icons' ? 'só o ícone' : null,
    contato === 'email' && ap.top_bar === 'one_phone' ? 'só quando não há telefone' : null,
  ].filter(Boolean).map(d => `, ${d}`).join('');
  const ligar = contato === 'telefone' && rodape ? ' No celular, quem toca no número já liga.' : '';
  if (rodape && faixa) return `Aparece no rodapé de todas as páginas e, ${FAIXA}${detalhe}.${ligar}`;
  if (rodape) return `Aparece no rodapé de todas as páginas.${ligar}`;
  if (faixa) return `Aparece só ${FAIXA}${detalhe}. O rodapé compacto não mostra.`;
  return 'Com o rodapé compacto e sem a faixa de cima, aparece só na página de manutenção.';
}

/** Ajuda do endereço: só o rodapé em colunas mostra. */
export function ondeApareceEndereco(apOuNada: Aparencia | undefined): string {
  const ap = apOuNada ?? APARENCIA_FABRICA;
  return ap.footer_layout === 'columns'
    ? 'Aparece no rodapé do site. Pode usar duas linhas.'
    : 'Com o rodapé compacto, o endereço não aparece no site. Pode usar duas linhas.';
}

/** Frase da tela Redes sociais: onde os links aparecem, pelo nome ou só o ícone. */
export function ondeAparecemRedes(apOuNada: Aparencia | undefined): string {
  const ap = apOuNada ?? APARENCIA_FABRICA;
  const rodape = ap.footer_layout === 'columns';
  const pelaFaixa = ap.top_bar === 'two_phones' || ap.top_bar === 'one_phone';
  const icones = ap.top_bar === 'icons';
  if (rodape && pelaFaixa) return `O nome de cada rede aparece como link no rodapé de todas as páginas e, ${FAIXA}.`;
  if (rodape && icones) return 'O nome de cada rede aparece como link no rodapé de todas as páginas. No computador, a faixa de cima das páginas internas mostra só o ícone de cada rede.';
  if (rodape) return 'O nome de cada rede aparece como link no rodapé de todas as páginas.';
  if (pelaFaixa) return 'No computador, o nome de cada rede aparece como link na faixa de cima das páginas internas. O rodapé compacto não mostra as redes.';
  if (icones) return 'No computador, a faixa de cima das páginas internas mostra só o ícone de cada rede. O rodapé compacto não mostra as redes.';
  return 'Com o rodapé compacto e sem a faixa de cima, as redes não aparecem no site.';
}
