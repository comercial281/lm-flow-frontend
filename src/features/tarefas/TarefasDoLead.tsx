import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { apiErrorMessage } from '@/utils/apiHelpers';
import JanelaDaTarefa from './JanelaDaTarefa';
import LinhaDaTarefa from './LinhaDaTarefa';
import { TEXTOS_DE_TAREFAS as T } from './textos';
import { EVENTO_TAREFAS_MUDARAM, tarefasService } from './tarefasService';
import type { TarefaAtividade } from './tipos';

interface Props {
  /** Cards do lead cujas tarefas aparecem (Conversa: todos os funis em que ele está). */
  pipelineItemIds: string[];
  /** Card onde a tarefa nova nasce. null = sem card: o botão some (quem chama mostra o "Colocar no funil"). */
  criarNoCard: string | null;
  /** Pra aba do card mostrar o número e o marcador de atrasada. */
  aoContar?: (r: { abertas: number; atrasadas: number }) => void;
  /** Abre a janela de tarefa nova assim que montar (depois do "Colocar no funil"). */
  abrirNovaAgora?: boolean;
  aoAbrirNova?: () => void;
}

type Janela = { modo: 'nova'; categoria?: string } | { modo: 'editar'; tarefa: TarefaAtividade } | null;

const atrasadaPrimeiro = (a: TarefaAtividade, b: TarefaAtividade) =>
  Number(b.overdue) - Number(a.overdue) || (a.due_at ?? '').localeCompare(b.due_at ?? '');

/**
 * Bloco fechado das tarefas do lead (Frente 2, 07/10/2026): o mesmo na aba
 * Tarefas do card, na seção Tarefas da Conversa e na página do card completo.
 */
export default function TarefasDoLead({ pipelineItemIds, criarNoCard, aoContar, abrirNovaAgora, aoAbrirNova }: Props) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [abertas, setAbertas] = useState<TarefaAtividade[]>([]);
  const [feitas, setFeitas] = useState<TarefaAtividade[]>([]);
  const [verFeitas, setVerFeitas] = useState(false);
  const [janela, setJanela] = useState<Janela>(null);
  const chave = pipelineItemIds.join(',');
  const contar = useRef(aoContar);
  contar.current = aoContar;

  const carregar = useCallback(async () => {
    if (!chave) {
      setAbertas([]);
      setFeitas([]);
      contar.current?.({ abertas: 0, atrasadas: 0 });
      return;
    }
    const ids = chave.split(',');
    try {
      const [a, f] = await Promise.all([
        tarefasService.listar({ bucket: 'para_fazer', kind: 'task', pipeline_item_ids: ids, per_page: 50 }),
        tarefasService.listar({ bucket: 'concluidas', kind: 'task', pipeline_item_ids: ids, per_page: 20 }),
      ]);
      const lista = (a.data as TarefaAtividade[]).sort(atrasadaPrimeiro);
      setAbertas(lista);
      setFeitas(f.data as TarefaAtividade[]);
      contar.current?.({ abertas: lista.length, atrasadas: lista.filter(t => t.overdue).length });
    } catch {
      setAbertas([]);
      setFeitas([]);
    }
  }, [chave]);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    const aoMudar = () => void carregar();
    window.addEventListener(EVENTO_TAREFAS_MUDARAM, aoMudar);
    return () => window.removeEventListener(EVENTO_TAREFAS_MUDARAM, aoMudar);
  }, [carregar]);
  useEffect(() => {
    if (abrirNovaAgora && criarNoCard) {
      setJanela({ modo: 'nova' });
      aoAbrirNova?.();
    }
  }, [abrirNovaAgora, criarNoCard, aoAbrirNova]);

  const concluir = async (t: TarefaAtividade) => {
    try {
      await tarefasService.concluir(t.id);
      toast.success(T.concluida);
      const proxima = await confirmar({ titulo: T.proxima, descricao: t.title, rotuloDaAcao: T.novaTarefa, rotuloDeCancelar: T.agoraNao });
      if (proxima && criarNoCard) setJanela({ modo: 'nova', categoria: t.category ?? undefined });
    } catch (e) {
      toast.error(apiErrorMessage(e, T.erro));
    }
  };

  const reabrir = async (t: TarefaAtividade) => {
    try {
      await tarefasService.reabrir(t.id);
      toast.success(T.reaberta);
    } catch (e) {
      toast.error(apiErrorMessage(e, T.erro));
    }
  };

  const excluir = async (t: TarefaAtividade) => {
    const ok = await confirmar({ titulo: T.perguntaExcluir, descricao: T.perguntaExcluirDescricao, rotuloDaAcao: T.excluir, rotuloDeCancelar: T.cancelar, destrutivo: true });
    if (!ok) return;
    try {
      await tarefasService.excluir(t.id);
      toast.success(T.excluida);
    } catch (e) {
      toast.error(apiErrorMessage(e, T.erro));
    }
  };

  const acoes = { aoConcluir: concluir, aoReabrir: reabrir, aoEditar: (t: TarefaAtividade) => setJanela({ modo: 'editar', tarefa: t }), aoExcluir: excluir };

  return (
    <div className="space-y-2">
      {criarNoCard && (
        <Button size="sm" variant="outline" className="h-8" onClick={() => setJanela({ modo: 'nova' })}>
          <Plus className="mr-1 h-4 w-4" />
          {T.novaTarefa}
        </Button>
      )}
      {abertas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{T.semAbertas}</p>
      ) : (
        <ul className="divide-y divide-border/60">{abertas.map(t => <LinhaDaTarefa key={t.id} tarefa={t} {...acoes} />)}</ul>
      )}
      {feitas.length > 0 && (
        <div>
          <button type="button" className="text-xs font-medium text-muted-foreground hover:text-foreground" aria-expanded={verFeitas} onClick={() => setVerFeitas(v => !v)}>
            {T.concluidas} ({feitas.length})
          </button>
          {verFeitas && <ul className="divide-y divide-border/60">{feitas.map(t => <LinhaDaTarefa key={t.id} tarefa={t} {...acoes} />)}</ul>}
        </div>
      )}
      <JanelaDaTarefa
        aberta={janela !== null}
        aoFechar={() => setJanela(null)}
        aoSalvar={() => void carregar()}
        tarefa={janela?.modo === 'editar' ? janela.tarefa : null}
        pipelineItemId={criarNoCard}
        categoriaInicial={janela?.modo === 'nova' ? janela.categoria : undefined}
      />
      {dialogoDeConfirmacao}
    </div>
  );
}
