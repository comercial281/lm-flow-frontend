// "Minha ficha da IA" (fase 6, Tarefa 76): os números de que o corretor é dono, com a voz de cada
// um. O servidor já filtra (só dono efetivo; número dividido = um cartão por agente), então lista
// vazia quer dizer "sem tela": nem item no menu, nem página.
import { useCallback, useEffect, useState } from 'react';
import { useCan } from '@/hooks/useCan';
import { salesAgentsService, type MinhaFicha } from '@/services/salesAgents/salesAgentsService';

export const ROTA_MINHA_FICHA = '/ia-vendedora/minha-ficha';

export type EstadoDasFichas = 'carregando' | 'ok' | 'erro';

export function useMinhasFichas(ativo: boolean) {
  const [fichas, setFichas] = useState<MinhaFicha[]>([]);
  const [estado, setEstado] = useState<EstadoDasFichas>('carregando');

  useEffect(() => {
    if (!ativo) return;
    let cancelado = false;
    setEstado('carregando');
    salesAgentsService.minhasFichas()
      .then((lista) => { if (!cancelado) { setFichas(lista); setEstado('ok'); } })
      .catch(() => { if (!cancelado) { setFichas([]); setEstado('erro'); } });
    return () => { cancelado = true; };
  }, [ativo]);

  /** Troca a ficha salva (a resposta do servidor) sem reler a lista. */
  const trocar = useCallback((nova: MinhaFicha) => {
    setFichas((atuais) => atuais.map((f) => (f.id === nova.id ? nova : f)));
  }, []);

  return { fichas, temNumero: fichas.length > 0, estado, trocar };
}

/**
 * O item do menu: com a chave own_ficha, SEM sales_agents.read (quem lê a IA já tem a tela
 * completa) e com pelo menos um número. Só pergunta ao servidor quando as duas chaves batem.
 */
export function useMinhaFichaNoMenu(): boolean {
  const can = useCan();
  const ativo = can('sales_agent_numbers', 'own_ficha') && !can('sales_agents', 'read');
  const { temNumero } = useMinhasFichas(ativo);
  return ativo && temNumero;
}

/** Tira o item "Minha ficha da IA" quando não é visível. Seção sem o item passa intacta. */
export function aplicarMinhaFichaNoMenu<T extends { itens: { href?: string }[] }>(secoes: T[], visivel: boolean): T[] {
  if (visivel) return secoes;
  return secoes.map((secao) => (
    secao.itens.some((i) => i.href === ROTA_MINHA_FICHA)
      ? { ...secao, itens: secao.itens.filter((i) => i.href !== ROTA_MINHA_FICHA) }
      : secao
  ));
}
