import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dinheiro, numero } from '@/lib/formato';
import { overviewService } from '@/services/superAdmin/overviewService';
import type { ClientePooled } from '@/types/admin/clientes';
import type { ClienteComProblema, Numeros } from '@/types/admin/overview';
import { linhasDoProblema } from '@/pages/Admin/Area/VisaoGeral/formatoAtencao';
import AiUsageLine from '../AiUsageLine';
import { chaveDoCliente } from '../lista';

// Resumo do cliente: problemas da Atenção e números do mês, das MESMAS contas
// da Visão Geral (batem com ela). Cada parte carrega sozinha e falha sozinha.
export default function AbaResumo({ cliente: t }: { cliente: ClientePooled }) {
  const [problema, setProblema] = useState<ClienteComProblema | null | undefined>(undefined);
  const [numeros, setNumeros] = useState<Numeros | null | undefined>(undefined);

  useEffect(() => {
    overviewService.atencao()
      .then((a) => setProblema(a.clients.find((c) => (c.slug ?? c.schema) === chaveDoCliente(t)) ?? null))
      .catch(() => setProblema(null));
    overviewService.numeros({ periodo: 'mes_atual', tenant: t.schema_name })
      .then(setNumeros).catch(() => setNumeros(null));
  }, [t]);

  const totais = numeros?.totals;
  const cartoes = [
    { rotulo: 'Leads no mês', valor: totais && numero(totais.leads) },
    { rotulo: 'Conversas no mês', valor: totais && numero(totais.conversations) },
    { rotulo: 'Pessoas ativas', valor: totais && numero(totais.users_active) },
    { rotulo: 'Atendidos pela IA', valor: totais && numero(totais.ai_attended) },
    { rotulo: 'Custo da IA no mês', valor: totais && dinheiro(totais.ai_cost_brl) },
    { rotulo: 'Números de WhatsApp', valor: `${t.whatsapp_channels_used ?? '—'}${t.max_whatsapp_channels ? ` de ${t.max_whatsapp_channels}` : ''}` },
  ];

  return (
    <div className="flex flex-col gap-4">
      {problema && (
        <section aria-labelledby="problemas" className="rounded-lg border border-red-500/40 p-4">
          <h2 id="problemas" className="mb-2 text-sm font-medium">Precisa de atenção</h2>
          <ul className="flex flex-col gap-2">
            {problema.problems.flatMap((p) => linhasDoProblema(problema, p).map((l, i) => (
              <li key={`${p.kind}-${i}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{l.texto}</span><Link className="text-primary underline-offset-2 hover:underline" to={l.acao.href}>{l.acao.rotulo}</Link>
              </li>
            )))}
          </ul>
        </section>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cartoes.map((c) => (
          <div key={c.rotulo} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{c.rotulo}</p>
            <p className="mt-1 text-2xl font-semibold">{numeros === undefined && !c.rotulo.startsWith('Números') ? '…' : c.valor ?? '—'}</p>
          </div>
        ))}
      </div>
      {numeros === null && <p role="status" className="text-sm text-muted-foreground">Não deu pra ler os números do mês agora.</p>}
      <div className="rounded-lg border bg-card p-4"><AiUsageLine u={t.ai_usage} /></div>
    </div>
  );
}
