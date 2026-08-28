import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// A CATRACA PRECISA DE TESTE, E EU TINHA DEIXADO SEM.
//
// O conferir-caixinhas.mjs reprova o build quando o número de caixinhas
// nativas cresce na tela do cliente. Eu conferi isso à mão — e da primeira vez
// conferi ERRADO, lendo o $? depois de um `| tail`, que devolve o status do
// tail e não o do script. Portão cujo código de saída nunca foi lido de verdade
// não é portão.
//
// Este teste lê o código de saída sem cano nenhum, e nos DOIS sentidos: com o
// teto no número real ele passa, com o teto um abaixo ele reprova. Assim a
// catraca não pode apodrecer em silêncio.
//
// O teto do teste sai do próprio script, não de um número cravado aqui: número
// cravado em teste vira mentira no dia em que alguém consertar uma caixinha.

const SCRIPT = join(__dirname, 'conferir-caixinhas.mjs');

function rodar(args: string[] = []): { saida: string; codigo: number } {
  try {
    const saida = execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
    return { saida, codigo: 0 };
  } catch (e) {
    const erro = e as { stdout?: string; stderr?: string; status?: number };
    return { saida: (erro.stdout ?? '') + (erro.stderr ?? ''), codigo: erro.status ?? -1 };
  }
}

const contarCliente = (saida: string): number => {
  const linha = saida.split('\n').find(l => l.trim().startsWith('cliente'));
  if (!linha) throw new Error(`linha do cliente não encontrada em:\n${saida}`);
  const numeros = linha.trim().split(/\s+/).slice(1).map(Number);
  return numeros[numeros.length - 1]; // o total é a última coluna
};

describe('conferir-caixinhas', () => {
  it('conta e lista sem teto, saindo com 0', () => {
    const { saida, codigo } = rodar();
    expect(codigo).toBe(0);
    expect(saida).toContain('caixinhas nativas do navegador');
    expect(contarCliente(saida)).toBeGreaterThanOrEqual(0);
  });

  it('PASSA quando o teto é o número real', () => {
    const atual = contarCliente(rodar().saida);
    const { codigo } = rodar(['--teto', String(atual)]);
    expect(codigo).toBe(0);
  });

  it('REPROVA quando o número passa do teto', () => {
    // É o caso que importa: sem isto, a catraca poderia estar sempre saindo 0 e
    // ninguém saberia até alguém encher a tela de window.confirm de novo.
    const atual = contarCliente(rodar().saida);
    const { saida, codigo } = rodar(['--teto', String(atual - 1)]);
    expect(codigo).toBe(1);
    expect(saida).toContain('useConfirmacao');
  });

  it('não conta definição de método como caixinha', () => {
    // `async confirm(id)` de um service não é window.confirm. Este falso
    // positivo quase virou "achado" na quarta contagem.
    const { saida } = rodar();
    expect(saida).not.toContain('services/visits/visitsService.ts');
    expect(saida).not.toContain('services/bolsao/bolsaoService.ts');
  });
});
