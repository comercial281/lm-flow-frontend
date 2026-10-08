// src/pages/Customer/Settings/Listas/abasDasListas.ts
// A aba "Categorias de tarefa" fica escondida (decisão de 08/10, revisão final
// do funil): as tarefas ainda oferecem a lista fixa (`CATEGORIAS_INICIAIS` em
// features/tarefas/textos.ts) e guardam o nome. Mostrar a aba agora faria o
// gestor renomear ou arquivar uma categoria sem efeito nenhum nas tarefas.
// Ligar (true) no mesmo PR em que a sessão de Tarefas passar a ler
// `list_options` (`task_categories`). O código da aba continua pronto.
export const CATEGORIAS_DE_TAREFA_NA_TELA = false;
