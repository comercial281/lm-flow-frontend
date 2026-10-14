// Imóvel que vem do site do cliente: o site sempre ganha (decisão do Tony, 13/10/2026).
// Trava CAMPO POR CAMPO, só o que o leitor daquela fonte preenche: o servidor manda a
// lista em `feed.locked_fields` (nome da coluna) e ignora esses campos no salvar.
// O resto da seção segue livre (ex.: na lista combinada do Leilão, rua, CEP, banheiros e condomínio).
// Fonte desligada = lista vazia = nada trava.
import { createContext, useContext } from 'react';

export const AVISO_DO_SITE = 'Este imóvel vem do site da imobiliária. O que vem de lá fica travado: mude no site e o LM Flow atualiza em até 1 hora.';

/** Dica curta em cada campo travado (aparece ao passar o mouse). */
export const DICA_DO_CAMPO = 'Vem do site da imobiliária: mude no site.';

// Nome no formulário → nome da coluna no servidor, quando são diferentes.
const NOME_NO_SERVIDOR: Record<string, string> = { address_zip: 'address_cep' };

export function campoTravado(campo: string, travados: readonly string[]): boolean {
  if (!travados.length) return false;
  return travados.includes(campo) || travados.includes(NOME_NO_SERVIDOR[campo] ?? campo);
}

/** Lista de campos travados do imóvel aberto no cadastro (o CadastroDoImovel fornece). */
export const CamposTravadosContext = createContext<readonly string[]>([]);

/** O campo (nome do formulário) está travado porque vem do site? */
export function useCampoTravado(campo: string): boolean {
  return campoTravado(campo, useContext(CamposTravadosContext));
}

/** `title` do campo travado; nada quando está livre. */
export const dicaSe = (travado: boolean): string | undefined => (travado ? DICA_DO_CAMPO : undefined);
