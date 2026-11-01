// A página de agentes (fase 6, tarefa 68): a entrada da IA Vendedora quando o
// endereço não tem `ia`. Um quadro por agente, com os números de 30 dias, e o
// "+ Novo agente" tracejado no fim.
//
// ⚠️ Os resumos são lidos UMA vez, ao abrir. Falha tira só o rodapé dos quadros
// (sem aviso vermelho): os quadros em si vêm da lista que a casca já leu.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { salesAgentsService, type ResumoDoAgente, type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import EmptyState from '@/components/base/EmptyState';
import QuadroDoAgente from './QuadroDoAgente';

export default function PaginaDeAgentes({ agents, podeCriar }: { agents: SalesAgent[]; podeCriar: boolean }) {
  const [resumos, setResumos] = useState<Map<string, ResumoDoAgente>>(new Map());

  useEffect(() => {
    let vivo = true;
    salesAgentsService.resumos()
      .then((lista) => { if (vivo) setResumos(new Map(lista.map((r) => [r.id, r]))); })
      .catch(() => { /* sem resumo: o quadro fica sem o rodapé */ });
    return () => { vivo = false; };
  }, []);

  // O agente juntado (fase 2) já é filtrado pela casca, ao ler a lista.
  if (agents.length === 0 && !podeCriar) {
    return <EmptyState title="Ainda não há agente de IA por aqui." description="Peça ao gestor da conta pra criar um." />;
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
      {agents.map((a) => <QuadroDoAgente key={a.id} agent={a} resumo={resumos.get(a.id) ?? null} />)}
      {podeCriar && (
        <Link
          to="/ia-vendedora/novo"
          className="flex min-h-[160px] flex-col justify-center gap-1 rounded-xl border border-dashed border-sidebar-border p-5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <b className="text-foreground">+ Novo agente</b>
          <span className="text-sm text-muted-foreground">Começa escolhendo o modo operante:</span>
          <span className="mt-2 grid gap-2 text-xs text-muted-foreground">
            <span><b className="block text-foreground">Filtra e passa</b>Qualifica e passa o lead pronto na hora.</span>
            <span><b className="block text-foreground">Leva até a visita</b>Qualifica, marca na agenda e passa depois.</span>
          </span>
        </Link>
      )}
    </div>
  );
}
