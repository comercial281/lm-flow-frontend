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

/** Nome do campo no formulário a partir do nome do servidor (address_cep → address_zip). */
export function nomeNoFormulario(campoDoServidor: string): string {
  const par = Object.entries(NOME_NO_SERVIDOR).find(([, srv]) => srv === campoDoServidor);
  return par ? par[0] : campoDoServidor;
}

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

export const DICA_DO_CONDOMINIO = 'Vem do condomínio: mude no cadastro do condomínio.';

/** Campos que o condomínio plugado controla (nomes do formulário ou do servidor). */
export const CamposDoCondominioContext = createContext<readonly string[]>([]);

/** Só os campos travados pelo site (o site vence o condomínio). A página fornece. */
export const CamposDoSiteContext = createContext<readonly string[]>([]);

/** Dica do campo: a do site se o site trava, senão a do condomínio, senão nada. */
export function useDicaDoCampo(campo: string): string | undefined {
  const doSite = useContext(CamposDoSiteContext);
  const doCondominio = useContext(CamposDoCondominioContext);
  if (campoTravado(campo, doSite)) return DICA_DO_CAMPO;
  if (campoTravado(campo, doCondominio)) return DICA_DO_CONDOMINIO;
  return undefined;
}
