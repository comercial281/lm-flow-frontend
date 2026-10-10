import { createContext, useContext, type ReactNode, type Ref } from 'react';
import { cn } from '@/lib/utils';
import { useOcupaCanto } from '@/components/support/cantoOcupado';

// ── PÁGINA: a moldura única das telas (07/10/2026, pedido do dono) ───────────
//
// Toda tela do menu nasce aqui. Folga até o menu de 16px (24px de sm pra cima),
// conteúdo até 1400px e o cabeçalho da casa (BaseHeader) sempre no mesmo ponto.
// O modelo é a Roleta de leads, que o dono aprovou. A trava `foraDaMoldura` do
// scripts/conferir-padrao.mjs reprova cabeçalho fora desta moldura.
//
// rolagem="pagina" (padrão): a tela inteira rola.
// rolagem="conteudo": o cabeçalho fica parado e só o conteúdo rola. É o das
//   listas com tabela e paginação (Contatos, Etiquetas…): o filho que rola
//   continua sendo o da própria tela (`flex-1 overflow-auto`). A paginação fica
//   no canto inferior direito, então a bolinha do suporte vira a aba lateral
//   (`useOcupaCanto`, 10/10/2026).
// No modo página, o fim da rolagem tem folga do tamanho da bolinha: o último
//   botão à direita (Salvar, Próxima) para acima dela, não embaixo.
// estreita: formulário que não deve esticar fica até max-w-4xl, À ESQUERDA
//   (nunca centralizado: o título não pode mudar de lugar entre telas).
//
// Rotas-moldura (Bolsão, Integrações) não desenham título: entregam abas e o
// "← voltar" pelo ExtrasDaMolduraContext, e a Pagina põe no lugar certo.

export interface ExtrasDaMoldura {
  acima?: ReactNode;
  abaixoDoCabecalho?: ReactNode;
}

export const ExtrasDaMolduraContext = createContext<ExtrasDaMoldura>({});
export const useExtrasDaMoldura = () => useContext(ExtrasDaMolduraContext);

export interface PaginaProps {
  /** O cabeçalho da casa: <BaseHeader/> ou um XxxHeader que o usa. */
  cabecalho?: ReactNode;
  /** Acima do título: "← volta" de tela de detalhe, trilha do Meu site/IA. */
  acima?: ReactNode;
  /** Barra própria encostada no topo (Meu site, IA Vendedora). Rola junto; se a barra tiver ação que precisa ficar à vista (Salvar), a tela põe `sticky top-0 z-10` nela, como em ChannelSettings. */
  barraDoTopo?: ReactNode;
  rolagem?: 'pagina' | 'conteudo';
  estreita?: boolean;
  className?: string;
  dataTour?: string;
  /** O elemento que rola (modo página), pra tela que precisa rolar até um bloco. */
  rolagemRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
}

export default function Pagina({
  cabecalho,
  acima,
  barraDoTopo,
  rolagem = 'pagina',
  estreita = false,
  className,
  dataTour,
  rolagemRef,
  children,
}: PaginaProps) {
  const extras = useExtrasDaMoldura();
  useOcupaCanto(rolagem === 'conteudo');
  const topo = (
    <>
      {extras.acima}
      {acima}
      {cabecalho}
      {extras.abaixoDoCabecalho}
    </>
  );

  if (rolagem === 'conteudo') {
    return (
      <div className="flex h-full min-h-0 flex-col" data-tour={dataTour}>
        {barraDoTopo}
        <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6">
          <div className={cn('mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-6', className)}>
            {topo}
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-tour={dataTour}>
      <div ref={rolagemRef} className="flex-1 overflow-y-auto">
        {barraDoTopo}
        <div className="px-4 pb-20 pt-6 sm:px-6">
          <div className={cn('mx-auto w-full max-w-[1400px] space-y-6', className)}>
            {topo}
            {estreita ? <div className="w-full max-w-4xl space-y-6">{children}</div> : children}
          </div>
        </div>
      </div>
    </div>
  );
}
