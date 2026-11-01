// O `gravar` dos testes das páginas: confere que a página só grava os campos
// DELA (a mesma régua do ConfigurarPaginas) e guarda as chamadas. Devolve `true`
// (gravou) por padrão; `falhar()` faz a próxima devolver `false` (servidor recusou).
import { vi } from 'vitest';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { camposDaMudanca } from '@/pages/Customer/Automations/SalesAgents/configurar/useGravarNaHora';
import { conferirCamposDaPagina, type PaginaId } from '@/pages/Customer/Automations/SalesAgents/configurar/paginas';

//
// `'legado'`: páginas antigas que a reestruturação do Configurar (Tarefa 70) já desmontou e que as
// Tarefas 71 a 74 reescrevem ou apagam (Canal, Identidade, Objetivo, Critério, Abertura com
// variações, Catálogo): gravam campos que nenhuma página nova tem, então a régua não vale pra elas.
export function gravarDeTeste(pagina: PaginaId | 'legado') {
  let proxima = true;
  const gravar = vi.fn(async (mudanca: Partial<SalesAgent>, subchaves?: string[]) => {
    if (pagina !== 'legado') conferirCamposDaPagina(pagina, camposDaMudanca(mudanca, subchaves));
    const r = proxima;
    proxima = true;
    return r;
  });
  return Object.assign(gravar, { falhar: () => { proxima = false; } });
}
