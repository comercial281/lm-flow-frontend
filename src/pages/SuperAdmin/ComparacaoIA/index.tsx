import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import {
  superAgentsService, type ComparisonCandidate, type ComparisonResult, type ComparisonSide, type SuperAgent,
} from '@/services/superAdmin/superAgentsService';
import { CENARIOS_DE_TESTE } from '@/features/salesAgents/cenariosDeTeste';
import { linhasDoQueAconteceria } from '@/features/salesAgents/ensaio';
import {
  ITENS_DA_REGUA, ROTEIROS_DISPONIVEIS, corpoDoItem, filaDeAvaliacao, nota, resumo, resumoEmTexto, veredito,
} from './formatoComparacao';

const MAX_CONVERSAS = 15;

function Lado({ titulo, lado }: { titulo: string; lado: ComparisonSide }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">{titulo}</p>
      {lado.turn.messages.map((m, i) => <p key={i} className="rounded bg-primary/10 px-2 py-1 text-sm whitespace-pre-wrap">{m.content}</p>)}
      {lado.turn.messages.length === 0 && <p className="text-xs text-muted-foreground">(não respondeu)</p>}
      <ul className="text-[11px] text-muted-foreground">
        {linhasDoQueAconteceria(lado.turn.outcome).map((l) => <li key={l}>{l}</li>)}
      </ul>
      {lado.comment && <p className="text-[11px] italic text-muted-foreground">{lado.comment}</p>}
    </div>
  );
}

/**
 * Comparação antigo × novo (entrega 3). Cada resposta REAL da IA vira um teste
 * com o histórico real até ali, uma vez com cada roteiro; a avaliadora dá a nota.
 * Gasta IA paga e lê conversa real de cliente: só super-admin.
 */
export default function ComparacaoIA() {
  const [agentes, setAgentes] = useState<SuperAgent[]>([]);
  const [agenteId, setAgenteId] = useState('');
  const [antigo, setAntigo] = useState(ROTEIROS_DISPONIVEIS[0]);
  const [novo, setNovo] = useState(ROTEIROS_DISPONIVEIS[ROTEIROS_DISPONIVEIS.length - 1]);
  const [conversas, setConversas] = useState<ComparisonCandidate[]>([]);
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set());
  const [comCenarios, setComCenarios] = useState(true);
  const [pares, setPares] = useState<ComparisonResult[]>([]);
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);
  const [rodando, setRodando] = useState(false);
  const [soDiscordam, setSoDiscordam] = useState(false);
  const parar = useRef(false);

  useEffect(() => {
    superAgentsService.listAll().then(setAgentes).catch(() => toast.error('Não consegui listar as IAs.'));
  }, []);

  const agente = agentes.find((a) => a.id === agenteId) ?? null;
  const r = useMemo(() => resumo(pares), [pares]);

  const buscar = async () => {
    if (!agente) return;
    try {
      const lista = await superAgentsService.comparisonCandidates(agente.id, agente.tenant_slug,
        { baseline_version: antigo, candidate_version: novo });
      setConversas(lista);
      setEscolhidas(new Set(lista.slice(0, MAX_CONVERSAS).map((c) => c.id)));
      setPares([]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const alternar = (id: string) => setEscolhidas((prev) => {
    const prox = new Set(prev);
    if (prox.has(id)) prox.delete(id);
    else if (prox.size < MAX_CONVERSAS) prox.add(id);
    return prox;
  });

  const comparar = async () => {
    if (!agente) return;
    const fila = filaDeAvaliacao(conversas.filter((c) => escolhidas.has(c.id)), comCenarios ? CENARIOS_DE_TESTE : []);
    const runId = globalThis.crypto.randomUUID();
    parar.current = false;
    setRodando(true);
    setPares([]);
    setProgresso({ feito: 0, total: fila.length });
    for (const [i, item] of fila.entries()) {
      if (parar.current) break;
      try {
        const par = await superAgentsService.comparisonEvaluate(agente.id, agente.tenant_slug, {
          run_id: runId, baseline_version: antigo, candidate_version: novo, ...corpoDoItem(item),
        });
        setPares((prev) => [...prev, par]);
      } catch (e) {
        const msg = (e as Error).message;
        toast.error(msg);
        if (/no máximo|avaliações hoje/i.test(msg)) break;
      }
      setProgresso({ feito: i + 1, total: fila.length });
    }
    setRodando(false);
  };

  const copiar = async () => {
    if (!agente) return;
    await navigator.clipboard?.writeText(resumoEmTexto(r, agente.name, antigo, novo));
    toast.success('Resumo copiado');
  };

  const visiveis = soDiscordam ? pares.filter((p) => p.disagreement) : pares;

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-lg font-semibold">Comparação de roteiros</h1>
        <p className="text-sm text-muted-foreground">
          Cada resposta real da IA é refeita com os dois roteiros, no modelo da própria IA, e uma IA avaliadora dá nota.
          Nada é enviado; a conversa real só é lida.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">IA
          <select aria-label="IA" className="ml-1 h-9 rounded-md border px-2 text-sm" value={agenteId} onChange={(e) => setAgenteId(e.target.value)}>
            <option value="">Escolha…</option>
            {agentes.map((a) => <option key={`${a.tenant_slug}-${a.id}`} value={a.id}>{a.tenant_name} · {a.name}</option>)}
          </select>
        </label>
        <label className="text-xs">Antigo
          <select aria-label="Roteiro antigo" className="ml-1 h-9 rounded-md border px-2 text-sm" value={antigo} onChange={(e) => setAntigo(Number(e.target.value))}>
            {ROTEIROS_DISPONIVEIS.map((v) => <option key={v} value={v}>Roteiro {v}</option>)}
          </select>
        </label>
        <label className="text-xs">Novo
          <select aria-label="Roteiro novo" className="ml-1 h-9 rounded-md border px-2 text-sm" value={novo} onChange={(e) => setNovo(Number(e.target.value))}>
            {ROTEIROS_DISPONIVEIS.map((v) => <option key={v} value={v}>Roteiro {v}</option>)}
          </select>
        </label>
        <Button variant="outline" onClick={() => void buscar()} disabled={!agente || rodando}>Buscar conversas</Button>
      </div>

      {conversas.length > 0 && (
        <section className="space-y-2 rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Até {MAX_CONVERSAS} conversas por comparação. Cada ponto custa 2 respostas + 1 avaliação.</p>
          {conversas.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={escolhidas.has(c.id)} onChange={() => alternar(c.id)} />
              {c.contact_name ?? 'Sem nome'} · {c.points} {c.points === 1 ? 'resposta' : 'respostas'}
              {c.in_handoff ? ' · passou pro corretor' : ''}{c.has_visit ? ' · marcou visita' : ''}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={comCenarios} onChange={(e) => setComCenarios(e.target.checked)} aria-label="Incluir os cenários do Testar" />
            Incluir os cenários do Testar
          </label>
          <div className="flex gap-2">
            <Button onClick={() => void comparar()} disabled={rodando || (escolhidas.size === 0 && !comCenarios)}>Comparar</Button>
            {rodando && <Button variant="ghost" onClick={() => { parar.current = true; }}>Parar</Button>}
            {progresso && <span className="self-center text-xs text-muted-foreground">
              {rodando && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}Avaliadas {progresso.feito} de {progresso.total}
            </span>}
          </div>
        </section>
      )}

      {pares.length > 0 && (
        <section className="space-y-2 rounded-md border p-3">
          <table className="text-sm">
            <thead><tr><th className="pr-4 text-left">Item</th><th className="pr-4">Antigo</th><th>Novo</th></tr></thead>
            <tbody>
              {r.itens.map((i) => (
                <tr key={i.chave}>
                  <td className="pr-4">{i.rotulo}</td>
                  <td className="pr-4 text-center">{i.mediaAntigo === null ? '—' : i.mediaAntigo.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                  <td className="text-center">{i.mediaNovo === null ? '—' : i.mediaNovo.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm font-medium">{veredito(r)}</p>
          <p className="text-xs text-muted-foreground">{r.discordancias} de {r.total} respostas com nota diferente.</p>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => void copiar()}>Copiar resumo</Button>
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={soDiscordam} onChange={(e) => setSoDiscordam(e.target.checked)} aria-label="Só onde discordam" />
              Só onde discordam
            </label>
          </div>
        </section>
      )}

      {visiveis.map((p) => (
        <article key={`${p.conversation_id ?? p.scenario_id}-${p.point_index ?? ''}`} className="space-y-2 rounded-md border p-3">
          <p className="text-xs font-medium">
            {p.scenario_id ? `Cenário: ${CENARIOS_DE_TESTE.find((c) => c.id === p.scenario_id)?.label ?? p.scenario_id}` : `Conversa · resposta ${(p.point_index ?? 0) + 1}`}
          </p>
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted/30 p-2 text-[11px]">{p.history_tail}</pre>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_220px]">
            <Lado titulo={`Antigo (roteiro ${p.baseline.version})`} lado={p.baseline} />
            <Lado titulo={`Novo (roteiro ${p.candidate.version})`} lado={p.candidate} />
            <table className="text-xs">
              <thead><tr><th className="text-left">Nota</th><th>Antigo</th><th>Novo</th></tr></thead>
              <tbody>
                {ITENS_DA_REGUA.map((i) => (
                  <tr key={i.chave} className={p.baseline.scores[i.chave] !== p.candidate.scores[i.chave] ? 'font-semibold' : ''}>
                    <td>{i.rotulo}</td>
                    <td className="text-center">{nota(p.baseline.scores[i.chave])}</td>
                    <td className="text-center">{nota(p.candidate.scores[i.chave])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.real_reply && (
            <details className="text-xs">
              <summary>O que ela respondeu de verdade</summary>
              <p className="whitespace-pre-wrap">{p.real_reply}</p>
            </details>
          )}
        </article>
      ))}
    </div>
  );
}
