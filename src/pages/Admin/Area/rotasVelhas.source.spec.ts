import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// Faxina da Área do Admin (06/10/2026): o servidor apagou estas rotas. Trava
// para nenhuma tela voltar a chamá-las.
const SRC = resolve(__dirname, '../../..');
const ROTAS_QUE_SAIRAM = [
  '/super/activity',
  '/super/log_clients',
  '/super/user_metrics',
  '/super/sales_agents/costs',
  '/super/pooled_tenants/broadcast',
];

function arquivosDeCodigo(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivosDeCodigo(caminho);
    return /\.tsx?$/.test(nome) && !/\.spec\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

describe('faxina do admin', () => {
  it('nenhuma tela chama as rotas que o servidor apagou', () => {
    const achados = arquivosDeCodigo(SRC).flatMap((arquivo) => {
      const src = readFileSync(arquivo, 'utf8');
      return ROTAS_QUE_SAIRAM.filter((rota) => src.includes(rota)).map((rota) => `${relative(SRC, arquivo)} → ${rota}`);
    });
    expect(achados).toEqual([]);
  });
});
