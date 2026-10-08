// src/pages/Customer/Atividades/Atividades.tsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import BaseHeader from '@/components/base/BaseHeader';
import { Seletor } from '@/components/base/Seletor';
import { ScheduleVisitDialog } from '@/components/visits/ScheduleVisitDialog';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { visitsService, type PersonRef } from '@/services/visits/visitsService';
import JanelaDaTarefa from '@/features/tarefas/JanelaDaTarefa';
import LinhaDaTarefa from '@/features/tarefas/LinhaDaTarefa';
import LinhaDaVisita from '@/features/tarefas/LinhaDaVisita';
import { BALDES, CATEGORIAS_INICIAIS, TEXTOS_DE_TAREFAS as T } from '@/features/tarefas/textos';
import { EVENTO_TAREFAS_MUDARAM, tarefasService } from '@/features/tarefas/tarefasService';
import type { Atividade, Balde, RespostaDeAtividades, TarefaAtividade, TipoDeAtividade } from '@/features/tarefas/tipos';

const POR_PAGINA = 30;

/**
 * Atividades › Lista (Frente 2, 07/10/2026): tarefas e visitas por prazo, no
 * modelo da tela Atividades do Praedium. A Agenda (calendário de visitas) é a
 * outra aba, na mesma moldura. Tarefa abre o card do lead; visita abre o
 * resumo dela na Agenda.
 */
export default function Atividades() {
  const navigate = useNavigate();
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [balde, setBalde] = useState<Balde>('hoje');
  const [tipo, setTipo] = useState<TipoDeAtividade>('all');
  const [pessoa, setPessoa] = useState('');
  const [categoria, setCategoria] = useState('');
  const [busca, setBusca] = useState('');
  const [buscaFirme, setBuscaFirme] = useState('');
  const [pagina, setPagina] = useState(1);
  const [resposta, setResposta] = useState<RespostaDeAtividades | null>(null);
  const [pessoas, setPessoas] = useState<PersonRef[]>([]);
  const [janela, setJanela] = useState<{ tarefa: TarefaAtividade | null } | null>(null);
  const [agendandoVisita, setAgendandoVisita] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setBuscaFirme(busca.trim()), 300);
    return () => window.clearTimeout(id);
  }, [busca]);
  useEffect(() => setPagina(1), [balde, tipo, pessoa, categoria, buscaFirme]);
  useEffect(() => { visitsService.realtors().then(setPessoas).catch(() => setPessoas([])); }, []);

  const carregar = useCallback(async () => {
    try {
      setResposta(await tarefasService.listar({
        bucket: balde, kind: tipo, page: pagina, per_page: POR_PAGINA,
        ...(pessoa ? { assigned_to_id: pessoa } : {}),
        ...(categoria ? { category: categoria } : {}),
        ...(buscaFirme ? { q: buscaFirme } : {}),
      }));
    } catch (e) {
      toast.error(apiErrorMessage(e, T.erro));
    }
  }, [balde, tipo, pessoa, categoria, buscaFirme, pagina]);

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
      try { await tarefasService.concluir(t.id); toast.success(T.concluida); } catch (e) { toast.error(apiErrorMessage(e, T.erro)); }
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

  const linha = (a: Atividade) =>
    a.kind === 'task'
      ? <LinhaDaTarefa key={`t-${a.id}`} tarefa={a} mostrarLead {...acoes} />
      : <LinhaDaVisita key={`v-${a.id}`} visita={a} aoAbrir={v => navigate(`/visits?visita=${v.id}`)} />;

  return (
    <div className="flex h-full flex-col gap-4 px-6 py-4">
      <BaseHeader
        title="Atividades"
        subtitle="Tarefas e visitas por prazo."
        searchValue={busca}
        onSearchChange={setBusca}
        searchPlaceholder="Buscar por tarefa ou lead"
        primaryAction={{ label: T.novaTarefa, onClick: () => setJanela({ tarefa: null }) }}
        secondaryActions={[{ label: 'Agendar visita', variant: 'outline', onClick: () => setAgendandoVisita(true) }]}
      />

      <div role="group" aria-label="Prazo" className="flex flex-wrap gap-1 border-b border-border">
        {BALDES.map(b => (
          <button
            key={b.chave}
            type="button"
            aria-pressed={balde === b.chave}
            onClick={() => setBalde(b.chave)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${balde === b.chave ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {b.rotulo} ({contagem(b.chave)})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Seletor aria-label="Tipo" value={tipo} onChange={e => setTipo(e.target.value as TipoDeAtividade)} className="w-40">
          <option value="all">Tarefas e visitas</option>
          <option value="task">Só tarefas</option>
          <option value="visit">Só visitas</option>
        </Seletor>
        <Seletor aria-label="Categoria" value={categoria} onChange={e => setCategoria(e.target.value)} className="w-48">
          <option value="">Todas as categorias</option>
          {CATEGORIAS_INICIAIS.map(c => <option key={c} value={c}>{c}</option>)}
        </Seletor>
        {!somenteMinhas && (
          <Seletor aria-label="Pessoa" value={pessoa} onChange={e => setPessoa(e.target.value)} className="w-48">
            <option value="">Todas as pessoas</option>
            {pessoas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Seletor>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-background px-4">
        {resposta && itens.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nada por aqui.</p>
        ) : (
          <ul className="divide-y divide-border/60">{itens.map(linha)}</ul>
        )}
      </div>

      {total > POR_PAGINA && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button type="button" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">Anterior</button>
          <span className="tabular-nums">{pagina} de {Math.ceil(total / POR_PAGINA)}</span>
          <button type="button" disabled={pagina * POR_PAGINA >= total} onClick={() => setPagina(p => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40">Próxima</button>
        </div>
      )}

      <JanelaDaTarefa
        aberta={janela !== null}
        aoFechar={() => setJanela(null)}
        aoSalvar={() => void carregar()}
        tarefa={janela?.tarefa ?? null}
        escolherLead={!janela?.tarefa}
      />
      <ScheduleVisitDialog open={agendandoVisita} onOpenChange={setAgendandoVisita} onCreated={() => void carregar()} />
      {dialogoDeConfirmacao}
    </div>
  );
}
