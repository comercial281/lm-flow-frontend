// src/pages/Admin/Area/VisaoGeral/Atencao.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import { Button } from '@/components/ui/ds';
import { numero } from '@/lib/formato';
import { overviewService } from '@/services/superAdmin/overviewService';
import type { Atencao as DadosAtencao } from '@/types/admin/overview';
import { CONTADORES, linhasDoProblema } from './formatoAtencao';

// Visão Geral → Atenção (padrão do /admin): quem precisa do dono agora.
// Regras e cortes no diário (frontend/CLAUDE.md, "Visão Geral nova").
export default function Atencao() {
  const [dados, setDados] = useState<DadosAtencao | null>(null);
  const [erro, setErro] = useState(false);
  const seq = useRef(0);

  const carregar = useCallback(async () => {
    const minha = ++seq.current;
    setErro(false);
    setDados(null);
    try {
      const r = await overviewService.atencao();
      if (minha === seq.current) setDados(r);
    } catch {
      if (minha === seq.current) setErro(true);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  if (erro) return <EmptyState tipo="erro" title="Não deu para carregar a Visão Geral" aoTentarDeNovo={() => void carregar()} />;
  if (!dados) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {CONTADORES.map((c) => <div key={c.chave} className="h-20 animate-pulse rounded-lg bg-muted" />)}
        </div>
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {CONTADORES.map((c) => (
          <div key={c.chave} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{c.rotulo}</p>
            <p className="mt-1 text-2xl font-semibold">{numero(dados.counts[c.chave])}</p>
          </div>
        ))}
      </div>

      {dados.unreadable.length > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
          <span>Não deu pra conferir: {dados.unreadable.map((u) => u.name).join(', ')}.</span>
          <Button variant="outline" size="sm" onClick={() => void carregar()}>Tentar de novo</Button>
        </div>
      )}

      {dados.clients.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border p-4 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Tudo em ordem nos {numero(dados.ok_count)} clientes
        </div>
      ) : (
        <section className="flex flex-col gap-3" aria-labelledby="precisa-de-atencao">
          <h2 id="precisa-de-atencao" className="text-sm font-medium text-muted-foreground">Precisa de atenção</h2>
          {dados.clients.map((c) => (
            <article key={c.schema} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className={c.severity === 'vermelho' ? 'h-4 w-4 text-red-600 dark:text-red-400' : 'h-4 w-4 text-amber-600 dark:text-amber-400'} />
                <h3 className="font-medium">{c.name}</h3>
              </div>
              <ul className="mt-2 flex flex-col gap-2">
                {c.problems.flatMap((p) => linhasDoProblema(c, p).map((l, i) => (
                  <li key={`${p.kind}-${i}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className={p.severity === 'vermelho' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}>{l.texto}</span>
                    <Button asChild variant="outline" size="sm"><Link to={l.acao.href}>{l.acao.rotulo}</Link></Button>
                  </li>
                )))}
              </ul>
            </article>
          ))}
          {dados.ok_count > 0 && <p className="text-sm text-muted-foreground">Os outros {numero(dados.ok_count)} clientes estão em ordem.</p>}
        </section>
      )}
    </div>
  );
}
