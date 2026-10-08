import api from '@/services/core/api';
import type { DadosDaTarefa, ParametrosDaLista, RespostaDeAtividades, TarefaAtividade } from './tipos';

// Card, Conversa e Atividades se escutam: mexeu numa, as outras releem.
export const EVENTO_TAREFAS_MUDARAM = 'lmflow:tarefas-mudaram';
export function avisarTarefasMudaram() {
  window.dispatchEvent(new CustomEvent(EVENTO_TAREFAS_MUDARAM));
}

/** `lead_sem_card` quando o servidor recusa criar tarefa pra lead fora do funil. */
export function motivoDoErro(e: unknown): string | null {
  const motivo = (e as { response?: { data?: { error?: { details?: { motivo?: string } } } } })?.response?.data?.error?.details?.motivo;
  return motivo ?? null;
}

async function mudou<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  const res = await p;
  avisarTarefasMudaram();
  return res.data.data;
}

export const tarefasService = {
  async listar(params: ParametrosDaLista): Promise<RespostaDeAtividades> {
    const { pipeline_item_ids, ...resto } = params;
    const query = pipeline_item_ids ? { ...resto, pipeline_item_ids: pipeline_item_ids.join(',') } : resto;
    const res = await api.get('/activities', { params: query });
    return res.data as RespostaDeAtividades;
  },
  criar: (dados: DadosDaTarefa) => mudou<TarefaAtividade>(api.post('/tasks', { task: dados })),
  editar: (id: string, dados: DadosDaTarefa) => mudou<TarefaAtividade>(api.patch(`/tasks/${id}`, { task: dados })),
  concluir: (id: string) => mudou<TarefaAtividade>(api.post(`/tasks/${id}/complete`)),
  reabrir: (id: string) => mudou<TarefaAtividade>(api.post(`/tasks/${id}/reopen`)),
  excluir: (id: string) => mudou<{ id: string }>(api.delete(`/tasks/${id}`)),
};
