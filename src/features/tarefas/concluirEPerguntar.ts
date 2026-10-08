import { toast } from 'sonner';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { TEXTOS_DE_TAREFAS as T } from './textos';
import { tarefasService } from './tarefasService';
import type { TarefaAtividade } from './tipos';

type Confirmar = (opcoes: {
  titulo: string;
  descricao?: string;
  rotuloDaAcao?: string;
  rotuloDeCancelar?: string;
}) => Promise<boolean>;

/**
 * "Concluir já puxa a próxima" (regra da Frente 2): conclui a tarefa e pergunta
 * se quer criar a próxima no mesmo card. Um lugar só, usado pela aba/seção do
 * lead e pelas Atividades. Devolve true quando a pessoa quer criar a próxima
 * (quem chama abre a janela no card e na categoria da tarefa concluída).
 */
export async function concluirEPerguntar(t: TarefaAtividade, confirmar: Confirmar): Promise<boolean> {
  try {
    await tarefasService.concluir(t.id);
    toast.success(T.concluida);
  } catch (e) {
    toast.error(apiErrorMessage(e, T.erro));
    return false;
  }
  return confirmar({ titulo: T.proxima, descricao: t.title, rotuloDaAcao: T.novaTarefa, rotuloDeCancelar: T.agoraNao });
}
