// O `gravar` dos testes das páginas: confere que a página só grava os campos
// DELA (a mesma régua do ConfigurarPaginas) e guarda as chamadas. Devolve `true`
// (gravou) por padrão; `falhar()` faz a próxima devolver `false` (servidor recusou).
import { vi } from 'vitest';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { camposDaMudanca } from '@/pages/Customer/Automations/SalesAgents/configurar/useGravarNaHora';
import { conferirCamposDaPagina, type PaginaId } from '@/pages/Customer/Automations/SalesAgents/configurar/paginas';

export function gravarDeTeste(pagina: PaginaId) {
  let proxima = true;
  const gravar = vi.fn(async (mudanca: Partial<SalesAgent>, subchaves?: string[]) => {
    conferirCamposDaPagina(pagina, camposDaMudanca(mudanca, subchaves));
    const r = proxima;
    proxima = true;
    return r;
  });
  return Object.assign(gravar, { falhar: () => { proxima = false; } });
}
