// O passo a passo da configuração da IA (entrega 2): o MESMO pra criar e pra
// editar. Trilho clicável à esquerda, um passo por vez, cada um com o próprio
// Salvar. Sem `?passo=`, abre direto no primeiro passo que tem pendência.
//
// ⚠️ Trocar de passo com alteração não salva pergunta antes (o registro do
// useAlteracoesNaoSalvas é global: o passo aberto marca, o trilho lê).
import { useEffect, useMemo, type ReactElement } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { PEDIDO_SAIR_SEM_SALVAR, temAlteracaoPendente } from '@/hooks/useAlteracoesNaoSalvas';
import { passoComPendencia, pendenciasDosPassos } from '@/features/salesAgents/pendencias';
import { lerEscolhas } from '@/features/salesAgents/tresEscolhas';
import type { InboxOption } from '../configuracao/comum';
import { PASSOS, passoDaUrl, type DestinoDoPasso, type NumeroDoPasso, type PropsDoPasso } from './passos';
import Passo1QuemEla from './passos/Passo1QuemEla';
import Passo2Objetivo from './passos/Passo2Objetivo';
import Passo3Roteiro from './passos/Passo3Roteiro';
import Passo4Visita from './passos/Passo4Visita';
import Passo5Vende from './passos/Passo5Vende';
import Passo6Atendimento from './passos/Passo6Atendimento';
import Passo7VoltarAChamar from './passos/Passo7VoltarAChamar';
import Passo8TestarLigar from './passos/Passo8TestarLigar';
import Avancado from './Avancado';

const COMPONENTES: Record<DestinoDoPasso, (p: PropsDoPasso) => ReactElement> = {
  1: Passo1QuemEla, 2: Passo2Objetivo, 3: Passo3Roteiro, 4: Passo4Visita,
  5: Passo5Vende, 6: Passo6Atendimento, 7: Passo7VoltarAChamar, 8: Passo8TestarLigar,
  avancado: Avancado,
};

export interface PassoAPassoProps {
  agent: SalesAgent;
  inboxes: InboxOption[];
  aoSalvo: (a: SalesAgent) => void;
}

export default function PassoAPasso({ agent, inboxes, aoSalvo }: PassoAPassoProps) {
  const [params, setParams] = useSearchParams();
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const daUrl = passoDaUrl(params.get('passo'));
  const pendentes = useMemo(() => new Set(pendenciasDosPassos(agent).map((p) => p.passo)), [agent]);
  const vaiAteOFim = lerEscolhas(agent).alcance === 'visit';
  const atual: DestinoDoPasso = daUrl ?? (passoComPendencia(agent) as NumeroDoPasso | null) ?? 1;

  const escrever = (destino: DestinoDoPasso, replace: boolean) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set('passo', String(destino));
      return n;
    }, { replace });

  // Sem `?passo=`: grava no endereço onde abriu (o Voltar do navegador sai da página).
  useEffect(() => {
    if (daUrl === null) escrever(atual, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o endereço chega sem passo
  }, [daUrl]);

  const irParaPasso = async (destino: DestinoDoPasso) => {
    if (destino === atual) return;
    if (temAlteracaoPendente() && !(await confirmar(PEDIDO_SAIR_SEM_SALVAR))) return;
    escrever(destino, false);
  };

  const Componente = COMPONENTES[atual];

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <nav aria-label="Passos da configuração" className="shrink-0 lg:w-60">
        <ol className="space-y-1">
          {PASSOS.map((p) => {
            const travado = p.numero === 4 && !vaiAteOFim;
            const pendente = pendentes.has(p.numero);
            return (
              <li key={p.numero}>
                <button type="button" disabled={travado} aria-current={atual === p.numero ? 'step' : undefined}
                  title={travado ? 'Só quando ela vai até o fim (passo Objetivo)' : undefined}
                  onClick={() => void irParaPasso(p.numero as NumeroDoPasso)}
                  className={cn('flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                    atual === p.numero ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-sidebar-accent',
                    travado && 'cursor-not-allowed opacity-50')}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs">{p.numero}</span>
                  <span className="flex-1">{p.titulo}</span>
                  {pendente && (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
                      <span className="sr-only">(tem pendência)</span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="min-w-0 flex-1">
        <Componente agent={agent} inboxes={inboxes} aoSalvo={aoSalvo} irParaPasso={(d) => void irParaPasso(d)} />
      </div>
      {dialogoDeConfirmacao}
    </div>
  );
}
