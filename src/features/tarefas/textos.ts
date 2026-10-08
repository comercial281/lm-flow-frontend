import type { Balde } from './tipos';

// Até as Listas da casa (`task_categories`) entrarem no ar: os mesmos quatro
// nomes do contrato com a sessão do funil. Na troca, esta lista sai e a janela
// lê `GET /api/v1/list_options?list=task_categories`.
export const CATEGORIAS_INICIAIS = ['Follow-up', 'Oferta ativa', 'Atualização de imóvel', 'Outro'];

export const BALDES: { chave: Balde; rotulo: string }[] = [
  { chave: 'para_fazer', rotulo: 'Para fazer' },
  { chave: 'hoje', rotulo: 'Vence hoje' },
  { chave: 'amanha', rotulo: 'Amanhã' },
  { chave: 'atrasadas', rotulo: 'Atrasadas' },
  { chave: 'semana', rotulo: 'Esta semana' },
  { chave: 'proxima_semana', rotulo: 'Semana que vem' },
  { chave: 'concluidas', rotulo: 'Concluídas' },
];

export const TEXTOS_DE_TAREFAS = {
  titulo: 'Tarefas',
  novaTarefa: 'Nova tarefa',
  editarTarefa: 'Editar tarefa',
  categoria: 'Categoria',
  tituloDoCampo: 'O que fazer',
  exemploDeTitulo: 'Ex.: ligar pra confirmar a visita',
  data: 'Data',
  hora: 'Hora',
  responsavel: 'Responsável',
  responsavelDoLead: 'Responsável do lead',
  descricao: 'Detalhes (opcional)',
  salvar: 'Salvar',
  criar: 'Criar tarefa',
  cancelar: 'Cancelar',
  concluir: 'Concluir',
  reabrir: 'Reabrir',
  editar: 'Editar',
  excluir: 'Excluir',
  atrasada: 'Atrasada',
  semAbertas: 'Nenhuma tarefa aberta.',
  concluidas: 'Concluídas',
  criada: 'Tarefa criada.',
  salva: 'Tarefa salva.',
  concluida: 'Tarefa concluída.',
  reaberta: 'Tarefa reaberta.',
  excluida: 'Tarefa excluída.',
  erro: 'Não deu certo. Tente de novo.',
  faltaTitulo: 'Escreva o que é pra fazer.',
  faltaData: 'Escolha a data.',
  faltaLead: 'Escolha o lead.',
  proxima: 'Criar a próxima tarefa deste lead?',
  agoraNao: 'Agora não',
  perguntaExcluir: 'Excluir esta tarefa?',
  perguntaExcluirDescricao: 'Ela some do card e das Atividades. Não tem volta.',
  semCard: 'Pra criar tarefa, coloque o lead no funil.',
  semCardAtividades: 'Esse lead ainda não está no funil. Coloque ele no funil pela conversa ou pelo card e crie a tarefa de novo.',
  lead: 'Lead',
  buscarLead: 'Buscar por nome ou telefone',
} as const;
