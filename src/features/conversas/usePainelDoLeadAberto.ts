import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { painelAoTrocarDeConversa } from './painelDoLead';

/**
 * Aberto/fechado do painel do lead em Conversas.
 *
 * - Ao trocar a conversa selecionada: em tela larga abre (mesmo depois do X);
 *   abaixo de 1280px fica como estava.
 * - Endereço sem conversa (/conversations): fecha.
 *
 * As duas regras olham coisas diferentes DE PROPÓSITO. Ao abrir uma conversa a
 * partir de /conversations, a seleção muda antes do endereço (o `navigate` do
 * roteador roda em transição). Se o fechamento também dependesse do estado
 * aberto, ele rodaria com o endereço ainda vazio e fecharia o painel que a
 * seleção acabou de abrir. Por isso o fechamento depende SÓ do endereço.
 */
export function usePainelDoLeadAberto(
  conversaNoEndereco: string | null | undefined,
  conversaSelecionada: string | null | undefined,
  telaLarga: boolean,
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [aberto, setAberto] = useState(false);

  // A largura é lida na troca, não acompanhada: redimensionar não reabre o que o X fechou.
  const telaLargaRef = useRef(telaLarga);
  telaLargaRef.current = telaLarga;

  useEffect(() => {
    if (!conversaNoEndereco) setAberto(false);
  }, [conversaNoEndereco]);

  useEffect(() => {
    if (!conversaSelecionada) return;
    setAberto(atual => painelAoTrocarDeConversa(telaLargaRef.current, atual));
  }, [conversaSelecionada]);

  return [aberto, setAberto];
}
