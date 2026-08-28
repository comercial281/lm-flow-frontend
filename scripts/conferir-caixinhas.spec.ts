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

const contar = (saida: string, area: 'cliente' | 'superadmin'): number => {
  const linha = saida.split('\n').find(l => l.trim().startsWith(area));
  if (!linha) throw new Error(`linha de ${area} não encontrada em:\n${saida}`);
  const numeros = linha.trim().split(/\s+/).slice(1).map(Number);
  return numeros[numeros.length - 1]; // o total é a última coluna
};

const contarCliente = (saida: string) => contar(saida, 'cliente');
const contarSuper = (saida: string) => contar(saida, 'superadmin');

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

  // ── a catraca do SuperAdmin ────────────────────────────────────────────────
  // Ela nasceu depois, e por um motivo diferente do teto do cliente: lá o
  // argumento é ilusão de produto, aqui é o que a confirmação está segurando —
  // redeploy de TODOS os tenants, semear dado fictício num cliente real, ligar
  // o modo demonstração. Duas catracas, dois motivos, e cada uma precisa ser
  // exercitada nos dois sentidos.
  it('--teto-super PASSA no número real e REPROVA um abaixo', () => {
    const atual = contarSuper(rodar().saida);

    expect(rodar(['--teto-super', String(atual)]).codigo).toBe(0);

    const { saida, codigo } = rodar(['--teto-super', String(atual - 1)]);
    expect(codigo).toBe(1);
    expect(saida).toContain('SuperAdmin');
  });

  // Os dois tetos são independentes: estourar um não pode deixar o outro passar
  // batido, e passar num não pode mascarar o estouro do outro.
  it('os dois tetos convivem sem se atrapalhar', () => {
    const saidaLimpa = rodar().saida;
    const cli = contarCliente(saidaLimpa);
    const sup = contarSuper(saidaLimpa);

    expect(rodar(['--teto', String(cli), '--teto-super', String(sup)]).codigo).toBe(0);
    expect(rodar(['--teto', String(cli - 1), '--teto-super', String(sup)]).codigo).toBe(1);
    expect(rodar(['--teto', String(cli), '--teto-super', String(sup - 1)]).codigo).toBe(1);
  });

  // Contar sem conseguir listar obriga quem for consertar a sair grepando à
  // mão — que é o erro que este script veio substituir. Sem --tudo a lista do
  // SuperAdmin fica de fora pra não empurrar a do cliente pra fora da tela.
  it('--tudo lista o SuperAdmin, e sem ele a lista sai só com o cliente', () => {
    const semFlag = rodar().saida;
    const comFlag = rodar(['--tudo']).saida;

    expect(semFlag).not.toContain('na tela do SuperAdmin');
    expect(comFlag).toContain('na tela do SuperAdmin');
    expect(comFlag).toContain('SuperAdmin/');
  });
});
