import { useCallback, useEffect, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfirmacao } from '@/hooks/useConfirmacao';

// ── ALTERAÇÃO NÃO SALVA: A TELA AVISA ANTES DE PERDER ───────────────────────
//
// POR QUE ISTO EXISTE
// O Raio-X achou três jeitos de salvar convivendo e "o usuário nunca sabe se
// gravou". A regra da Fase 3: campo espera o Salvar, e enquanto houver
// alteração pendente a BarraSalvar fica à vista e sair pergunta antes.
//
// POR QUE NÃO O useBlocker DO REACT ROUTER
// O app usa <BrowserRouter> (156 rotas). O useBlocker só funciona com o
// roteador de dados (createBrowserRouter), e migrar as rotas não é desta fase.
// Então a guarda cobre as duas saídas que importam:
//   1. fechar ou recarregar a aba → `beforeunload` (o navegador pergunta);
//   2. clicar no menu lateral ou numa aba da casa → `useGuardaDeSaida`.
// O botão "voltar" do navegador NÃO é coberto. Está escrito no CLAUDE.md.
//
// O registro é um conjunto por tela (cada uma com seu id), não um booleano
// global: duas telas montadas ao mesmo tempo não apagam o aviso uma da outra.

const pendentes = new Set<string>();

export function marcarPendente(id: string, pendente: boolean): void {
  if (pendente) pendentes.add(id);
  else pendentes.delete(id);
}

export function temAlteracaoPendente(): boolean {
  return pendentes.size > 0;
}

export function limparPendentes(): void {
  pendentes.clear();
}

/** Compara o que está na tela com o que foi carregado (ordem das chaves importa). */
export function mesmoConteudo(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** A tela declara se tem alteração pendente. Registra a guarda e o aviso do navegador. */
export function useAlteracoesNaoSalvas(temAlteracao: boolean): void {
  const id = useId();

  useEffect(() => {
    marcarPendente(id, temAlteracao);
    return () => marcarPendente(id, false);
  }, [id, temAlteracao]);

  useEffect(() => {
    if (!temAlteracao) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Navegadores antigos só perguntam com returnValue preenchido.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [temAlteracao]);
}

export const PEDIDO_SAIR_SEM_SALVAR = {
  titulo: 'Sair sem salvar?',
  descricao: 'Você tem alterações que ainda não foram salvas. Se sair agora, elas se perdem.',
  rotuloDaAcao: 'Sair sem salvar',
  rotuloDeCancelar: 'Continuar editando',
  destrutivo: true,
} as const;

/**
 * Pra quem desenha links de navegação (menu lateral, abas da casa): devolve um
 * `onClickCapture` que, com alteração pendente, segura o clique e pergunta.
 * Renderize `dialogoDeConfirmacao` junto.
 */
export function useGuardaDeSaida() {
  const navigate = useNavigate();
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const aoClicar = useCallback(
    async (e: React.MouseEvent) => {
      if (!temAlteracaoPendente()) return;
      const link = (e.target as HTMLElement).closest('a[href]');
      // Item do menu que só abre submenu não sai da tela: deixa passar.
      if (!link || link.hasAttribute('data-abre-submenu')) return;
      const destino = link.getAttribute('href');
      if (!destino || destino.startsWith('#') || destino.startsWith('http')) return;
      e.preventDefault();
      e.stopPropagation();
      if (await confirmar(PEDIDO_SAIR_SEM_SALVAR)) {
        limparPendentes();
        navigate(destino);
      }
    },
    [confirmar, navigate],
  );

  return { aoClicar, dialogoDeConfirmacao };
}
