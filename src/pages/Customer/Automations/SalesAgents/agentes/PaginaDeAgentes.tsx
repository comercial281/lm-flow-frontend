// A página de agentes (fase 6, tarefa 68): a entrada da IA Vendedora quando o
// endereço não tem `ia`. Um quadro por agente, com os números de 30 dias, e o
// "+ Novo agente" tracejado no fim. Desde 03/11/2026 o Testar abre direto do
// quadro, sem entrar no agente (a mesma janela do botão da barra).
//
// ⚠️ Os resumos são lidos UMA vez, ao abrir. Falha tira só os números dos quadros
// (sem aviso vermelho): os quadros em si vêm da lista que a casca já leu.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { salesAgentsService, type ResumoDoAgente, type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import EmptyState from '@/components/base/EmptyState';
import TestarJanela from '../telas/TestarJanela';
import QuadroDoAgente from './QuadroDoAgente';

export default function PaginaDeAgentes({ agents, podeCriar }: { agents: SalesAgent[]; podeCriar: boolean }) {
  const [resumos, setResumos] = useState<Map<string, ResumoDoAgente>>(new Map());
  const [testando, setTestando] = useState<SalesAgent | null>(null);

  useEffect(() => {
    let vivo = true;
    salesAgentsService.resumos()
      .then((lista) => { if (vivo) setResumos(new Map(lista.map((r) => [r.id, r]))); })
      .catch(() => { /* sem resumo: o quadro fica sem os números */ });
    return () => { vivo = false; };
  }, []);

  // O agente juntado (fase 2) já é filtrado pela casca, ao ler a lista.
  if (agents.length === 0 && !podeCriar) {
    return <EmptyState title="Ainda não há agente de IA por aqui." description="Peça ao gestor da conta pra criar um." />;
  }

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-5">
        {agents.map((a) => <QuadroDoAgente key={a.id} agent={a} resumo={resumos.get(a.id) ?? null} aoTestar={() => setTestando(a)} />)}
        {podeCriar && (
          <Link
            to="/ia-vendedora/novo"
            className="group flex min-h-[320px] flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-sidebar-border p-6 text-center transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span aria-hidden className="mb-3 flex h-[72px] w-[72px] items-center justify-center rounded-full border border-dashed border-sidebar-border text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
              <Plus className="h-7 w-7" />
            </span>
            <b className="text-foreground">+ Novo agente</b>
            <span className="text-sm text-muted-foreground">Começa escolhendo o modo operante:</span>
            <span className="mt-3 grid gap-2.5 text-xs text-muted-foreground">
              <span><b className="block text-foreground">Filtra e passa</b>Qualifica e passa o lead pronto na hora.</span>
              <span><b className="block text-foreground">Leva até a visita</b>Qualifica, marca na agenda e passa depois.</span>
            </span>
          </Link>
        )}
      </div>
      {testando && <TestarJanela agent={testando} aoFechar={() => setTestando(null)} />}
    </>
  );
}
