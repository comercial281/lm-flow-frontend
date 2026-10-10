import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

// ── O CARD ABERTO MORA NO ENDEREÇO (?card=) ─────────────────────────────────
//
// E0 do funil (07/10/2026). Antes, o quadro abria o card pelo ?card= e apagava
// o endereço inteiro na mesma hora: F5 fechava o card e o link copiado só valia
// uma vez. Agora:
//   - abrir (pelo link ou pelo clique) deixa o ?card= no endereço;
//   - fechar tira SÓ o ?card= (os outros parâmetros ficam, como o ?etapa= já fazia);
//   - card que não está no quadro carregado (arquivado, de outra aba, apagado)
//     liga `foraDaAba`, e o quadro mostra o aviso em vez de falhar calado. A
//     busca do card por id chega na Parte 4 (card completo).
//
// O quadro recarrega a cada 60 s e a cada evento ao vivo: `abertoRef` guarda o
// card que já foi aberto por este endereço, senão ele seria reaberto a cada volta.
//
// No celular (10/10/2026, features/cardDoLead/paginaNoCelular.ts) o ?card= NÃO
// abre a janela: `irParaPagina` troca o endereço pela página do card na hora,
// sem esperar o quadro carregar. É o ponto por onde passam Tarefas, Bolsão,
// Painel, notificações e link colado.

export const CHAVE_DO_CARD = 'card';

interface Opcoes<T extends { id: string | number }> {
  itens: T[];
  carregando: boolean;
  aoAbrir: (item: T) => void;
  /** Celular: em vez de abrir a janela, vai pra página do card (troca o endereço). */
  irParaPagina?: ((id: string) => void) | null;
}

export function useCardNoEndereco<T extends { id: string | number }>({ itens, carregando, aoAbrir, irParaPagina = null }: Opcoes<T>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const cardId = searchParams.get(CHAVE_DO_CARD);

  const abertoRef = useRef<string | null>(null);
  // O `setSearchParams` do roteador muda de identidade a cada mudança do
  // endereço; guardado num ref, abrir/fechar ficam estáveis pro card memoizado.
  const trocarEndereco = useRef(setSearchParams);
  trocarEndereco.current = setSearchParams;
  const aoAbrirRef = useRef(aoAbrir);
  aoAbrirRef.current = aoAbrir;
  const irParaPaginaRef = useRef(irParaPagina);
  irParaPaginaRef.current = irParaPagina;
  const noCelular = !!irParaPagina;

  useEffect(() => {
    if (!cardId) {
      abertoRef.current = null;
      return;
    }
    if (irParaPaginaRef.current) {
      if (abertoRef.current === cardId) return;
      abertoRef.current = cardId;
      irParaPaginaRef.current(cardId);
      return;
    }
    if (carregando || abertoRef.current === cardId) return;
    const achado = itens.find(i => String(i.id) === cardId);
    if (!achado) return;
    abertoRef.current = cardId;
    aoAbrirRef.current(achado);
  }, [cardId, itens, carregando, noCelular]);

  const abrirNoEndereco = useCallback((id: string) => {
    abertoRef.current = id;
    trocarEndereco.current(atual => {
      const novo = new URLSearchParams(atual);
      novo.set(CHAVE_DO_CARD, id);
      return novo;
    }, { replace: true });
  }, []);

  const fecharNoEndereco = useCallback(() => {
    abertoRef.current = null;
    trocarEndereco.current(atual => {
      if (!atual.has(CHAVE_DO_CARD)) return atual;
      const novo = new URLSearchParams(atual);
      novo.delete(CHAVE_DO_CARD);
      return novo;
    }, { replace: true });
  }, []);

  const foraDaAba = !noCelular && !!cardId && !carregando && !itens.some(i => String(i.id) === cardId);

  return { cardId, foraDaAba, abrirNoEndereco, fecharNoEndereco };
}
