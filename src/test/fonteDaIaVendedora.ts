// Leitura do código da tela da IA Vendedora pelos specs que conferem cicatrizes
// CALADAS (campo fora da lista do PATCH, chave de funcionalidade, frase que
// precisa estar na tela). Até 05/10/2026 a tela era um arquivo só, o
// SalesAgents.tsx; a casca nova (entrega 1 da refatoração) quebrou o código em
// uma peça por tela e uma por seção, e o spec não pode depender de em qual
// arquivo a frase mora — só de que ela continua na tela.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(__dirname, '../..');
const PASTA = join(RAIZ, 'src/pages/Customer/Automations/SalesAgents');

/** Um arquivo da pasta da tela, pelo caminho relativo a ela. */
export function lerTelaDaIa(relativo: string): string {
  return readFileSync(join(PASTA, relativo), 'utf8');
}

function arquivos(dir: string): string[] {
  return readdirSync(dir).sort().flatMap((nome) => {
    const cheio = join(dir, nome);
    // O assistente grava por conta própria (um PATCH, fora do saveAgent) e tem
    // conferência separada no playbookWiring: misturar os dois daria falso
    // positivo nas buscas "isto NÃO pode aparecer na tela".
    if (statSync(cheio).isDirectory()) return nome === 'assistente' ? [] : arquivos(cheio);
    return /\.tsx?$/.test(nome) && !/\.spec\.tsx?$/.test(nome) ? [cheio] : [];
  });
}

/** Todo o código da tela (casca primeiro, depois telas e configuração), sem specs e sem o assistente. */
export function fonteDaIaVendedora(): string {
  const casca = join(PASTA, 'SalesAgents.tsx');
  return [casca, ...arquivos(PASTA).filter((a) => a !== casca)]
    .map((a) => readFileSync(a, 'utf8'))
    .join('\n');
}
