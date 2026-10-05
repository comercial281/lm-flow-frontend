import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A trava roda no build e lê o dist/. Aqui ela roda contra um dist de mentira,
// montado no formato que o Vite gera (minificado, com __vite__mapDeps), e o
// código de saída é lido sem cano: com o site limpo ela passa, com o código de
// sessão alcançável por qualquer caminho ela reprova.

const SCRIPT = join(__dirname, 'conferir-dominio-limpo.mjs');
const pastas: string[] = [];

function rodar(dist: string): { saida: string; codigo: number } {
  try {
    const saida = execFileSync('node', [SCRIPT, '--dist', dist], { encoding: 'utf8', stdio: 'pipe' });
    return { saida, codigo: 0 };
  } catch (e) {
    const erro = e as { stdout?: string; stderr?: string; status?: number };
    return { saida: (erro.stdout ?? '') + (erro.stderr ?? ''), codigo: erro.status ?? -1 };
  }
}

/** Um dist com a entrada decidindo pelo endereço, como o src/main.tsx. */
function montarDist(arquivos: Record<string, string>): string {
  const dist = mkdtempSync(join(tmpdir(), 'dominio-limpo-'));
  pastas.push(dist);
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<html><head><script type="module" crossorigin src="/assets/main-A1.js"></script></head></html>');
  const base: Record<string, string> = {
    'main-A1.js':
      'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/mainDoSistema-S1.js","assets/react-R1.js","assets/mainDoSite-T1.js"])))=>i.map(i=>d[i]);' +
      'import{r as E}from"./react-R1.js";const D=x?f(()=>import("./mainDoSistema-S1.js"),__vite__mapDeps([0,1])):f(()=>import("./mainDoSite-T1.js"),__vite__mapDeps([2,1]));export{f as _};',
    'react-R1.js': 'export const r={};',
    'mainDoSistema-S1.js': 'import"./react-R1.js";const t=localStorage.getItem("access_token");',
    'mainDoSite-T1.js':
      'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/PortalHome-P1.js"])))=>i.map(i=>d[i]);' +
      'import{_ as i}from"./main-A1.js";import{r}from"./react-R1.js";const H=()=>i(()=>import("./PortalHome-P1.js"),__vite__mapDeps([0]));',
    'PortalHome-P1.js': 'import{r}from"./react-R1.js";export default function(){return null}',
  };
  for (const [nome, texto] of Object.entries({ ...base, ...arquivos })) writeFileSync(join(dist, 'assets', nome), texto);
  return dist;
}

afterEach(() => {
  while (pastas.length) rmSync(pastas.pop()!, { recursive: true, force: true });
});

describe('conferir-dominio-limpo', () => {
  it('passa com o site limpo, sem seguir o import() do mainDoSistema que a entrada faz', () => {
    const { saida, codigo } = rodar(montarDist({}));
    expect(saida).toContain('site do domínio limpo');
    expect(codigo).toBe(0);
  });

  it('reprova quando uma página do site importa algo com o token (import estático)', () => {
    const dist = montarDist({
      'PortalHome-P1.js': 'import{s}from"./sessao-Z1.js";export default function(){return null}',
      'sessao-Z1.js': 'export const s=()=>localStorage.getItem("access_token");',
    });
    const { saida, codigo } = rodar(dist);
    expect(codigo).toBe(1);
    expect(saida).toContain('access_token');
    expect(saida).toContain('assets/sessao-Z1.js');
  });

  it('reprova por import() dinâmico a partir de um pedaço do site', () => {
    const dist = montarDist({
      'PortalHome-P1.js': 'const c=()=>import("./cabo-C1.js");export default c',
      'cabo-C1.js': 'export const cabo=new ActionCable();',
    });
    const { saida, codigo } = rodar(dist);
    expect(codigo).toBe(1);
    expect(saida).toContain('ActionCable');
  });

  it('reprova pela lista de pré-carga do Vite (__vite__mapDeps)', () => {
    const dist = montarDist({
      'PortalHome-P1.js':
        'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/auth-U1.js"])))=>i.map(i=>d[i]);export default 1',
      'auth-U1.js': 'export function validityCheck(){}',
    });
    const { saida, codigo } = rodar(dist);
    expect(codigo).toBe(1);
    expect(saida).toContain('validityCheck');
  });

  it('reprova quando o próprio pedaço do site tem o termo', () => {
    const dist = montarDist({ 'mainDoSite-T1.js': 'const x="refresh_token";' });
    const { saida, codigo } = rodar(dist);
    expect(codigo).toBe(1);
    expect(saida).toContain('refresh_token');
  });

  it('reprova quando a entrada não decide pelo endereço (sem import do mainDoSite)', () => {
    const dist = montarDist({ 'main-A1.js': 'import"./react-R1.js";import("./mainDoSistema-S1.js");' });
    const { saida, codigo } = rodar(dist);
    expect(codigo).toBe(1);
    expect(saida).toContain('mainDoSite');
  });

  it('reprova quando a trava fica cega (nenhum termo nem no CRM)', () => {
    const dist = montarDist({ 'mainDoSistema-S1.js': 'export const crm=1;' });
    const { saida, codigo } = rodar(dist);
    expect(codigo).toBe(1);
    expect(saida).toContain('cega');
  });
});
