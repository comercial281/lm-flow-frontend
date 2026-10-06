import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button, Checkbox } from '@/components/ui/ds';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import {
  superAgentsService, type ComparisonCandidate, type ComparisonResult, type ComparisonSide, type SuperAgent,
} from '@/services/superAdmin/superAgentsService';
import { CENARIOS_DE_TESTE } from '@/features/salesAgents/cenariosDeTeste';
import { linhasDoQueAconteceria } from '@/features/salesAgents/ensaio';
import {
  ITENS_DA_REGUA, ROTEIROS_DISPONIVEIS, corpoDoItem, filaDeAvaliacao, nota, resumo, resumoEmTexto, veredito,
} from './formatoComparacao';
import { ESQUELETO, PAGINA, SECAO, SUBTITULO_SECAO, TITULO_SECAO } from '@/pages/Admin/Area/estilo';

// O servidor conta cenário como conversa da rodada (máximo 15 no total).
const MAX_DA_RODADA = 15;

function Lado({ titulo, lado }: { titulo: string; lado: ComparisonSide }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium">{titulo}</p>
      {lado.turn.messages.map((m, i) => <p key={i} className="whitespace-pre-wrap rounded bg-primary/10 px-2 py-1 text-sm">{m.content}</p>)}
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
 *
 * 06/10/2026: padrão da casa (Seletor, Checkbox, EmptyState, quadro, tokens).
 * Nenhuma regra da comparação mudou; o modelo da avaliadora segue a decidir pelo dono.
 */
export default function ComparacaoIA() {
  const [agentes, setAgentes] = useState<SuperAgent[]>([]);
  const [estadoAgentes, setEstadoAgentes] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
  const [agenteId, setAgenteId] = useState('');
  const [antigo, setAntigo] = useState(ROTEIROS_DISPONIVEIS[0]);
  const [novo, setNovo] = useState(ROTEIROS_DISPONIVEIS[ROTEIROS_DISPONIVEIS.length - 1]);
  const [conversas, setConversas] = useState<ComparisonCandidate[]>([]);
  const [busca, setBusca] = useState<'nada' | 'buscando' | 'pronta' | 'erro'>('nada');
  const [erroDaBusca, setErroDaBusca] = useState('');
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set());
  const [comCenarios, setComCenarios] = useState(true);
  const [pares, setPares] = useState<ComparisonResult[]>([]);
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);
  const [rodando, setRodando] = useState(false);
  const [soDiscordam, setSoDiscordam] = useState(false);
  const parar = useRef(false);
  // Sair da tela para a comparação: cada par é uma chamada paga no modelo da IA.
  useEffect(() => () => { parar.current = true; }, []);
  const maxConversas = MAX_DA_RODADA - (comCenarios ? CENARIOS_DE_TESTE.length : 0);

  const carregarAgentes = useCallback(async () => {
    setEstadoAgentes('carregando');
    try {
      setAgentes(await superAgentsService.listAll());
      setEstadoAgentes('pronto');
    } catch {
      setEstadoAgentes('erro');
    }
  }, []);

  useEffect(() => { void carregarAgentes(); }, [carregarAgentes]);

  const agente = agentes.find((a) => a.id === agenteId) ?? null;
  const r = useMemo(() => resumo(pares), [pares]);

  const recomecar = () => { setConversas([]); setEscolhidas(new Set()); setPares([]); setBusca('nada'); };

  const buscar = async () => {
    if (!agente) return;
    setBusca('buscando');
    try {
      const lista = await superAgentsService.comparisonCandidates(agente.id, agente.tenant_slug,
        { baseline_version: antigo, candidate_version: novo });
      setConversas(lista);
      setEscolhidas(new Set(lista.slice(0, maxConversas).map((c) => c.id)));
      setPares([]);
      setBusca('pronta');
    } catch (e) {
      setConversas([]);
      setErroDaBusca((e as Error).message);
      setBusca('erro');
    }
  };

  const alternar = (id: string) => setEscolhidas((prev) => {
    const prox = new Set(prev);
    if (prox.has(id)) prox.delete(id);
    else if (prox.size < maxConversas) prox.add(id);
    return prox;
  });

  const comparar = async () => {
    if (!agente) return;
    // Ligar os cenários depois de marcar 15 conversas passaria do teto: corta aqui.
    const fila = filaDeAvaliacao(conversas.filter((c) => escolhidas.has(c.id)).slice(0, maxConversas), comCenarios ? CENARIOS_DE_TESTE : []);
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
    <div className={`p-4 ${PAGINA}`}>
      <div>
        <h2 className={TITULO_SECAO}>Comparação de roteiros</h2>
        <p className={SUBTITULO_SECAO}>
          Cada resposta real da IA é refeita com os dois roteiros, no modelo da própria IA, e uma IA avaliadora dá nota.
          Nada é enviado; a conversa real só é lida.
        </p>
      </div>

      {estadoAgentes === 'carregando' && <div aria-busy="true" className={`h-10 ${ESQUELETO}`} />}
      {estadoAgentes === 'erro' && (
        <EmptyState tipo="erro" title="Não deu pra carregar as IAs" aoTentarDeNovo={() => void carregarAgentes()} />
      )}
      {estadoAgentes === 'pronto' && agentes.length === 0 && (
        <EmptyState title="Nenhuma IA Vendedora nos clientes" description="A comparação aparece quando algum cliente tiver a IA dele." />
      )}

      {estadoAgentes === 'pronto' && agentes.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">IA</span>
            <Seletor id="cmp-ia" disabled={rodando} aria-label="IA" className="w-72" value={agenteId} onChange={(e) => { setAgenteId(e.target.value); recomecar(); }}>
              <option value="">Escolha…</option>
              {agentes.map((a) => <option key={`${a.tenant_slug}-${a.id}`} value={a.id}>{a.tenant_name} · {a.name}</option>)}
            </Seletor>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Antigo</span>
            <Seletor id="cmp-antigo" disabled={rodando} aria-label="Roteiro antigo" className="w-36" value={String(antigo)} onChange={(e) => { setAntigo(Number(e.target.value)); recomecar(); }}>
              {ROTEIROS_DISPONIVEIS.map((v) => <option key={v} value={v}>Roteiro {v}</option>)}
            </Seletor>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Novo</span>
            <Seletor id="cmp-novo" disabled={rodando} aria-label="Roteiro novo" className="w-36" value={String(novo)} onChange={(e) => { setNovo(Number(e.target.value)); recomecar(); }}>
              {ROTEIROS_DISPONIVEIS.map((v) => <option key={v} value={v}>Roteiro {v}</option>)}
            </Seletor>
          </label>
          <Button variant="outline" onClick={() => void buscar()} disabled={!agente || rodando || busca === 'buscando'}>Buscar conversas</Button>
        </div>
      )}

      {busca === 'buscando' && <div aria-busy="true" className={`h-24 ${ESQUELETO}`} />}
      {busca === 'erro' && (
        <EmptyState tipo="erro" title="Não deu pra buscar as conversas" description={erroDaBusca} aoTentarDeNovo={() => void buscar()} />
      )}
      {busca === 'pronta' && conversas.length === 0 && (
        <EmptyState title="Nenhuma conversa com resposta da IA para comparar" description="Escolha outra IA ou outro par de roteiros." />
      )}

      {conversas.length > 0 && (
        <section aria-label="Conversas" className={`${SECAO} flex flex-col gap-2`}>
          <p className="text-xs text-muted-foreground">Até {maxConversas} conversas por comparação{comCenarios ? ', mais os cenários' : ''}. Cada ponto custa 2 respostas + 1 avaliação.</p>
          {conversas.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={escolhidas.has(c.id)} onCheckedChange={() => alternar(c.id)} aria-label={c.contact_name ?? 'Sem nome'} />
              {c.contact_name ?? 'Sem nome'} · {c.points} {c.points === 1 ? 'resposta' : 'respostas'}
              {c.in_handoff ? ' · passou pro corretor' : ''}{c.has_visit ? ' · marcou visita' : ''}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={comCenarios} onCheckedChange={(v) => setComCenarios(v === true)} aria-label="Incluir os cenários do Testar" />
            Incluir os cenários do Testar
          </label>
          <div className="flex gap-2">
            <Button onClick={() => void comparar()} disabled={rodando || (escolhidas.size === 0 && !comCenarios)}>Comparar</Button>
            {rodando && <Button variant="ghost" onClick={() => { parar.current = true; }}>Parar</Button>}
            {progresso && (
              <span className="self-center text-xs text-muted-foreground">
                {rodando && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" aria-hidden="true" />}Avaliadas {progresso.feito} de {progresso.total}
              </span>
            )}
          </div>
        </section>
      )}

      {pares.length > 0 && (
        <section aria-label="Resumo da comparação" className={`${SECAO} flex flex-col gap-2`}>
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
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={soDiscordam} onCheckedChange={(v) => setSoDiscordam(v === true)} aria-label="Só onde discordam" />
              Só onde discordam
            </label>
          </div>
        </section>
      )}

      {visiveis.map((p) => (
        <article key={`${p.conversation_id ?? p.scenario_id}-${p.point_index ?? ''}`} className={`${SECAO} flex flex-col gap-2`}>
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
