// O `gravar` dos testes das páginas: confere que a página só grava os campos
// DELA (a mesma régua do ConfigurarPaginas) e guarda as chamadas. Devolve `true`
// (gravou) por padrão; `falhar()` faz a próxima devolver `false` (servidor recusou).
import { vi } from 'vitest';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { camposDaMudanca } from '@/pages/Customer/Automations/SalesAgents/configurar/useGravarNaHora';
import { conferirCamposDaPagina, type PaginaId } from '@/pages/Customer/Automations/SalesAgents/configurar/paginas';
import { CAMPOS_DE_ENSINAR } from '@/pages/Customer/Automations/SalesAgents/configurar/camposDaIa';

//
// `'legado'`: páginas antigas que a reestruturação do Configurar (Tarefa 70) já desmontou e que as
// Tarefas 72 a 74 reescrevem ou apagam (Abertura com variações e Catálogo; Canal, Identidade,
// Objetivo e Critério já saíram na 71): gravam campos que nenhuma página nova tem, então a régua não vale pra elas.
//
// `'ensinar'` (Tarefa 75): as páginas do Ensinar só gravam `CAMPOS_DE_ENSINAR`, e `camposDaMudanca` recusa
// campo escondido (foi assim que a Instrucoes.tsx, que gravava `instructions`, se escondeu por dias).
export function gravarDeTeste(pagina: PaginaId | 'ensinar' | 'legado') {
  let proxima = true;
  const gravar = vi.fn(async (mudanca: Partial<SalesAgent>, subchaves?: string[]) => {
    if (pagina === 'ensinar') {
      const fora = camposDaMudanca(mudanca, subchaves).find((c) => !(CAMPOS_DE_ENSINAR as readonly string[]).includes(c));
      if (fora) throw new Error(`O Ensinar não grava ${fora}. Ponha o campo em CAMPOS_DE_ENSINAR.`);
    } else if (pagina !== 'legado') conferirCamposDaPagina(pagina, camposDaMudanca(mudanca, subchaves));
    const r = proxima;
    proxima = true;
    return r;
  });
  return Object.assign(gravar, { falhar: () => { proxima = false; } });
}
