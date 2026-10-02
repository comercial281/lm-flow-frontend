// O AVISO DE NÚMERO NA CAIXA DE CONVERSAS — a regra e os textos, fora do JSX.
//
// Pedido do dono do produto (02/10/2026): quem abria Conversas sem número
// conectado via "Nenhuma conversa encontrada — Não há conversas disponíveis no
// momento" e não sabia se era tela quebrada ou falta de alguma coisa. Os casos:
//
//   - não tem número nenhum → corretor: "peça ao gestor"; gestor: "Conectar WhatsApp"
//   - tem número, mas ele não está no ar (nunca leu o QR, ou caiu) e a lista está
//     vazia → "Conectar agora", direto na configuração do número
//   - tem conversas e o número caiu → faixa em cima da lista, com "Reconectar"
//
// Quem diz se o número está no ar é o SERVIDOR (`connection_status`, uma palavra
// só). Número criado e nunca pareado já vem 'disconnected'. Nulo = canal sem
// sessão (Cloud API, e-mail…): não tem o que cair, conta como funcionando.
//
// Textos LITERAIS de propósito: chave nova de t() não entra (o conferir-i18n só
// aceita trocar valor de chave que já existe). Linguagem: "número de WhatsApp",
// nunca instância, inbox ou canal.

import type { ChannelConnectionStatus } from '@/types/channels/inbox';

export interface NumeroDaConversa {
  id: string;
  name: string;
  connection_status?: ChannelConnectionStatus | null;
  owner_user_id?: string | null;
}

export interface NumeroForaDoAr {
  id: string;
  nome: string;
}

export type AvisoListaVazia =
  | { tipo: 'semNumero'; gestor: boolean; podeCriar: boolean }
  | { tipo: 'foraDoAr'; numeros: NumeroForaDoAr[] };

// O mesmo texto da tela de WhatsApp para o corretor sem número (menu novo,
// 01/10/2026): duas telas, uma frase só.
export const SEM_NUMERO_CORRETOR = {
  title: 'Você ainda não tem um número de WhatsApp',
  description: 'Peça ao gestor da sua imobiliária para criar o seu.',
};
export const SEM_NUMERO_GESTOR = {
  title: 'Nenhum número de WhatsApp conectado',
  description: 'Conecte o WhatsApp da imobiliária para as conversas começarem a chegar aqui.',
  acao: 'Conectar WhatsApp',
};
export const SEM_NUMERO_GESTOR_SEM_CRIAR = {
  title: 'Nenhum número de WhatsApp conectado',
  description: 'Quem conecta um número de WhatsApp é o administrador da conta.',
};
export const CONECTAR_AGORA = 'Conectar agora';
export const RECONECTAR = 'Reconectar';

/** Fora do ar = não recebe mensagem: caiu, nunca leu o QR, ou está no meio da leitura. */
function foraDoAr(numero: NumeroDaConversa): boolean {
  return numero.connection_status === 'disconnected' || numero.connection_status === 'connecting';
}

function paraAviso(numero: NumeroDaConversa): NumeroForaDoAr {
  return { id: String(numero.id), nome: numero.name };
}

/**
 * O que a lista VAZIA mostra no lugar de "Não há conversas disponíveis".
 * `null` = segue o texto de sempre (números no ar, ou ainda sem resposta).
 *
 * `numeros` é a lista que o servidor devolve para quem está olhando: o corretor
 * recebe só os números em que atende; o gestor (`gestor`, quem vê qualquer
 * número) recebe os da imobiliária toda. `null` = não carregou ou o cargo não
 * lê números — aí a tela não arrisca dizer nada.
 */
export function avisoListaVazia(entrada: {
  numeros: NumeroDaConversa[] | null;
  gestor: boolean;
  podeCriar: boolean;
}): AvisoListaVazia | null {
  const { numeros, gestor, podeCriar } = entrada;
  if (!numeros) return null;
  if (numeros.length === 0) return { tipo: 'semNumero', gestor, podeCriar: gestor && podeCriar };
  const caidos = numeros.filter(foraDoAr);
  if (caidos.length === 0) return null;
  return { tipo: 'foraDoAr', numeros: caidos.map(paraAviso) };
}

/**
 * Os números que a FAIXA de cima avisa, quando já há conversas na lista.
 *
 * Corretor: todo número da lista dele (são os em que ele atende). Gestor: só os
 * de que ele é o Dono do número — a lista dele é a imobiliária inteira, e um
 * número largado de propósito viraria faixa vermelha permanente na caixa de
 * todo gestor. A queda dos outros números já chega no sininho.
 */
export function numerosParaReconectar(entrada: {
  numeros: NumeroDaConversa[] | null;
  gestor: boolean;
  meuId: string | null | undefined;
}): NumeroForaDoAr[] {
  const { numeros, gestor, meuId } = entrada;
  if (!numeros) return [];
  const meus = gestor
    ? numeros.filter((n) => meuId != null && n.owner_user_id != null && String(n.owner_user_id) === String(meuId))
    : numeros;
  return meus.filter(foraDoAr).map(paraAviso);
}

export function tituloForaDoAr(numeros: NumeroForaDoAr[]): string {
  return numeros.length === 1
    ? 'Seu WhatsApp não está conectado'
    : 'Seus números de WhatsApp não estão conectados';
}

export function fraseForaDoAr(numeros: NumeroForaDoAr[]): string {
  return numeros.length === 1
    ? `Leia o QR code com o celular do número ${numeros[0].nome} para as conversas começarem a chegar aqui.`
    : 'Leia o QR code com o celular de cada número para as conversas começarem a chegar aqui.';
}

export function faixaReconectar(numeros: NumeroForaDoAr[]): string {
  return numeros.length === 1
    ? `O número ${numeros[0].nome} está desconectado. Mensagens novas só chegam depois de reconectar.`
    : `${numeros.length} números seus estão desconectados. Mensagens novas só chegam depois de reconectar.`;
}

/** A configuração do número, aberta na parte da conexão (o mesmo destino do aviso de queda). */
export function enderecoConexao(id: string): string {
  return `/channels/${id}/settings?tab=configuration`;
}
