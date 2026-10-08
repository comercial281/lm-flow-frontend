// src/pages/Customer/Tarefas/Tarefas.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import BaseHeader from '@/components/base/BaseHeader';
import Pagina from '@/components/base/Pagina';
import { Seletor } from '@/components/base/Seletor';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { visitsService, type PersonRef } from '@/services/visits/visitsService';
import JanelaDaTarefa from '@/features/tarefas/JanelaDaTarefa';
import LinhaDaTarefa from '@/features/tarefas/LinhaDaTarefa';
import { BALDES, CATEGORIAS_INICIAIS, TEXTOS_DE_TAREFAS as T } from '@/features/tarefas/textos';
import { EVENTO_TAREFAS_MUDARAM, tarefasService } from '@/features/tarefas/tarefasService';
import { concluirEPerguntar } from '@/features/tarefas/concluirEPerguntar';
import type { Balde, RespostaDeAtividades, TarefaAtividade } from '@/features/tarefas/tipos';

const POR_PAGINA = 30;

/**
 * Atividades › Tarefas (08/10/2026): só tarefas por prazo, no modelo da tela
 * Atividades do Praedium. Visita não aparece aqui: mora em Atividades › Visitas.
 * Clicar na tarefa abre o card do lead no Funil.
 */
export default function Tarefas() {
  const navigate = useNavigate();
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  // Filtros e página num só estado: mudar filtro volta à página 1 na MESMA
  // atualização, então uma mudança = um pedido.
  const [f, setF] = useState<{ balde: Balde; pessoa: string; categoria: string; buscaFirme: string; pagina: number }>(
    { balde: 'hoje', pessoa: '', categoria: '', buscaFirme: '', pagina: 1 },
  );
  const { balde, pessoa, categoria, buscaFirme, pagina } = f;
  const mudarFiltro = (parte: Partial<typeof f>) => setF(a => ({ ...a, ...parte, pagina: 1 }));
  const [busca, setBusca] = useState('');
  const ultimoPedido = useRef(0);
  const [resposta, setResposta] = useState<RespostaDeAtividades | null>(null);
  const [pessoas, setPessoas] = useState<PersonRef[]>([]);
  const [janela, setJanela] = useState<{ tarefa: TarefaAtividade | null; cardId?: string; categoria?: string } | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setF(a => (a.buscaFirme === busca.trim() ? a : { ...a, buscaFirme: busca.trim(), pagina: 1 })), 300);
    return () => window.clearTimeout(id);
  }, [busca]);
  useEffect(() => { visitsService.realtors().then(setPessoas).catch(() => setPessoas([])); }, []);

  const carregar = useCallback(async () => {
    const meu = ++ultimoPedido.current;
    try {
      const nova = await tarefasService.listar({
        bucket: balde, kind: 'task', page: pagina, per_page: POR_PAGINA,
        ...(pessoa ? { assigned_to_id: pessoa } : {}),
        ...(categoria ? { category: categoria } : {}),
        ...(buscaFirme ? { q: buscaFirme } : {}),
      });
      // Só o pedido mais recente vale: resposta atrasada não sobrescreve.
      if (meu === ultimoPedido.current) setResposta(nova);
    } catch (e) {
      if (meu === ultimoPedido.current) toast.error(apiErrorMessage(e, T.erro));
    }
  }, [balde, pessoa, categoria, buscaFirme, pagina]);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    const aoMudar = () => void carregar();
    window.addEventListener(EVENTO_TAREFAS_MUDARAM, aoMudar);
    return () => window.removeEventListener(EVENTO_TAREFAS_MUDARAM, aoMudar);
  }, [carregar]);

  const somenteMinhas = resposta?.meta.only_mine ?? true;
  const contagem = (b: Balde) => resposta?.meta.counts[b] ?? 0;
  const itens = resposta?.data ?? [];
  const total = resposta?.meta.total ?? 0;

  const acoes = {
    aoConcluir: async (t: TarefaAtividade) => {
      // A próxima tarefa nasce no card da que acabou de ser concluída.
      if (await concluirEPerguntar(t, confirmar)) setJanela({ tarefa: null, cardId: t.pipeline_item_id, categoria: t.category ?? undefined });
    },
    aoReabrir: async (t: TarefaAtividade) => {
      try { await tarefasService.reabrir(t.id); toast.success(T.reaberta); } catch (e) { toast.error(apiErrorMessage(e, T.erro)); }
    },
    aoEditar: (t: TarefaAtividade) => setJanela({ tarefa: t }),
    aoExcluir: async (t: TarefaAtividade) => {
      const ok = await confirmar({ titulo: T.perguntaExcluir, descricao: T.perguntaExcluirDescricao, rotuloDaAcao: T.excluir, rotuloDeCancelar: T.cancelar, destrutivo: true });
      if (!ok) return;
      try { await tarefasService.excluir(t.id); toast.success(T.excluida); } catch (e) { toast.error(apiErrorMessage(e, T.erro)); }
    },
    aoAbrir: (t: TarefaAtividade) => t.pipeline_id && navigate(`/pipelines/${t.pipeline_id}?card=${t.pipeline_item_id}`),
  };

  return (
    <Pagina
      cabecalho={
        <BaseHeader
          title="Tarefas"
          subtitle="Suas tarefas por prazo."
          searchValue={busca}
          onSearchChange={setBusca}
          searchPlaceholder="Buscar por tarefa ou lead"
        >
          <div role="group" aria-label="Prazo" className="flex gap-1 overflow-x-auto whitespace-nowrap border-b border-border">
            {BALDES.map(b => (
              <button
                key={b.chave}
                type="button"
                aria-pressed={balde === b.chave}
                onClick={() => mudarFiltro({ balde: b.chave })}
                className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm ${balde === b.chave ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                {b.rotulo} ({contagem(b.chave)})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Seletor aria-label="Categoria" value={categoria} onChange={e => mudarFiltro({ categoria: e.target.value })} className="w-48">
              <option value="">Todas as categorias</option>
              {CATEGORIAS_INICIAIS.map(c => <option key={c} value={c}>{c}</option>)}
            </Seletor>
            {!somenteMinhas && (
              <Seletor aria-label="Pessoa" value={pessoa} onChange={e => mudarFiltro({ pessoa: e.target.value })} className="w-48">
                <option value="">Todas as pessoas</option>
                {pessoas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Seletor>
            )}
            {/* Na linha dos filtros, não no topo (pedido do dono, 08/10/2026). */}
            <Button className="ml-auto" onClick={() => setJanela({ tarefa: null })}>
              <Plus className="mr-1 h-4 w-4" />
              {T.novaTarefa}
            </Button>
          </div>
        </BaseHeader>
      }
    >
      <div className="rounded-lg border border-border bg-background px-4">
        {resposta && itens.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{balde === 'hoje' ? 'Nada pra hoje.' : 'Nada por aqui.'}</p>
        ) : (
          <ul className="divide-y divide-border/60">{itens.map(t => <LinhaDaTarefa key={t.id} tarefa={t} mostrarLead {...acoes} />)}</ul>
        )}
      </div>

      {total > POR_PAGINA && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button type="button" disabled={pagina === 1} onClick={() => setF(a => ({ ...a, pagina: a.pagina - 1 }))} className="rounded border px-2 py-1 disabled:opacity-40">Anterior</button>
          <span className="tabular-nums">{pagina} de {Math.ceil(total / POR_PAGINA)}</span>
          <button type="button" disabled={pagina * POR_PAGINA >= total} onClick={() => setF(a => ({ ...a, pagina: a.pagina + 1 }))} className="rounded border px-2 py-1 disabled:opacity-40">Próxima</button>
        </div>
      )}

      <JanelaDaTarefa
        aberta={janela !== null}
        aoFechar={() => setJanela(null)}
        aoSalvar={() => void carregar()}
        tarefa={janela?.tarefa ?? null}
        pipelineItemId={janela?.cardId}
        categoriaInicial={janela?.categoria}
        escolherLead={!janela?.tarefa && !janela?.cardId}
      />
      {dialogoDeConfirmacao}
    </Pagina>
  );
}
