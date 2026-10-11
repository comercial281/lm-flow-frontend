// ── No celular, o lead abre na PÁGINA do card completo (10/10/2026) ─────────
//
// Raio-X do celular (tela 390×844): a janela do card (EditItemModal) não cabe
// no celular — a parte de cima ocupa ~600px e as abas ficam num vão de 112px
// com rolagem dentro de rolagem. A página do card completo funciona bem. Então,
// em tela de celular (abaixo de 768px, `useCelular`), todo caminho que
// abriria a janela navega pra página:
//   - quadro e lista do funil (clique no card e o `?card=` do endereço, que é
//     por onde chegam Tarefas, Bolsão, Painel, notificações e link colado);
//   - Contatos (`CardDoContato`, inclusive pelo endereço /contacts/:id);
//   - o "Abrir card do lead" do painel da conversa (`SecaoFunil`).
// No computador nada muda: a janela continua.
//
// O "voltar": quem abre de dentro do app manda `voltarPeloHistorico` no estado
// da navegação, e o "← Voltar" da página faz o mesmo que o voltar do navegador
// (volta pra onde a pessoa estava: quadro, Contatos, Tarefas, conversa). Sem
// isso (link colado, F5 sem histórico), a página mostra o "← Funil <nome>".
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { linkDoCardCompleto } from '@/features/pipelines/linkDoCard';

export interface EstadoDaPaginaDoCard {
  voltarPeloHistorico?: boolean;
}

/**
 * Há uma tela do app antes desta no histórico da guia? O BrowserRouter grava
 * `idx` em `window.history.state` (0 na primeira tela da guia) e o replace
 * preserva. Antes era `location.key !== 'default'`, que falhava: abrir
 * /contacts por link/F5 e depois ir pra /contacts/:id por dentro do app ainda
 * dava "primeira tela" (e qualquer replace trocava a chave). Lido na hora de
 * navegar, não ao montar.
 */
export const veioDeDentroDoApp = (): boolean => {
  const estado = typeof window !== 'undefined' ? (window.history.state as { idx?: number } | null) : null;
  return (estado?.idx ?? 0) > 0;
};

export const voltaPeloHistorico = (estado: unknown): boolean =>
  !!estado && typeof estado === 'object' && (estado as EstadoDaPaginaDoCard).voltarPeloHistorico === true;

interface OpcoesDeAbrir {
  /** Troca a entrada atual do histórico (quem chegou por um endereço que só abre o card). */
  substituir?: boolean;
  /** O "← Voltar" da página volta pelo histórico. Padrão: sim. */
  voltarPeloHistorico?: boolean;
}

export function useAbrirPaginaDoCard() {
  const navigate = useNavigate();
  return useCallback(
    (pipelineId: string | number, itemId: string | number, { substituir = false, voltarPeloHistorico = true }: OpcoesDeAbrir = {}) => {
      const estado: EstadoDaPaginaDoCard | null = voltarPeloHistorico ? { voltarPeloHistorico: true } : null;
      navigate(linkDoCardCompleto(String(pipelineId), String(itemId)), { replace: substituir, state: estado });
    },
    [navigate],
  );
}
