#!/usr/bin/env node
// Conta as caixinhas nativas do navegador (alert / confirm / prompt) que ainda
// existem no código, separando tela de cliente de tela de SuperAdmin.
//
// POR QUE ISTO EXISTE
// Esta contagem foi feita à mão três vezes, com três `grep` diferentes, e as
// três deram números diferentes. O erro foi sempre o mesmo: procurar
// `window.confirm(` e esquecer que `confirm(` sozinho chama o MESMO global.
// Treze chamadas ficaram invisíveis assim, em arquivos que ninguém tinha aberto.
//
// Contagem à mão não escala e não se repete igual. Esta roda sempre igual.
//
// O QUE ELE NÃO CONTA, DE PROPÓSITO
//   - definição de método com esse nome (`async confirm(id)` de um service não é
//     caixinha do navegador — foi o falso positivo que quase virou "achado")
//   - linha de comentário (as notas que explicam por que uma caixinha ficou
//     citam `window.confirm` no texto)
//   - arquivos de teste
//
// USO
//   node scripts/conferir-caixinhas.mjs                    conta, e lista as do cliente
//   node scripts/conferir-caixinhas.mjs --tudo             lista as do SuperAdmin também
//   node scripts/conferir-caixinhas.mjs --teto N           sai 1 se o CLIENTE passar de N
//   node scripts/conferir-caixinhas.mjs --teto-super N     sai 1 se o SUPERADMIN passar de N

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(RAIZ, 'src');

const CHAMADA = /(?<![.\w])(?:window\.)?(alert|confirm|prompt)\(/g;
const DEFINICAO = /(?:async\s+|function\s+|\*\s*)(?:alert|confirm|prompt)\s*\(/;

const andar = (dir, saida = []) => {
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules') continue;
    const cheio = join(dir, entrada);
    if (statSync(cheio).isDirectory()) andar(cheio, saida);
    else if (/\.(ts|tsx)$/.test(entrada) && !/\.(spec|test)\.tsx?$/.test(entrada)) saida.push(cheio);
  }
  return saida;
};

const achados = [];
for (const arquivo of andar(SRC)) {
  const rel = relative(RAIZ, arquivo);
  const area = rel.includes('SuperAdmin') ? 'superadmin' : 'cliente';
  const linhas = readFileSync(arquivo, 'utf8').split('\n');
  linhas.forEach((linha, i) => {
    const limpa = linha.trimStart();
    if (limpa.startsWith('//') || limpa.startsWith('*')) return;
    if (DEFINICAO.test(linha)) return;
    for (const m of linha.matchAll(CHAMADA)) {
      achados.push({ area, tipo: m[1], onde: `${rel}:${i + 1}` });
    }
  });
}

const conta = (area, tipo) => achados.filter(a => a.area === area && (!tipo || a.tipo === tipo)).length;

console.log('caixinhas nativas do navegador ainda no código\n');
console.log('              alert  confirm   prompt    total');
for (const area of ['cliente', 'superadmin']) {
  console.log(
    `  ${area.padEnd(12)}${String(conta(area, 'alert')).padStart(5)}` +
      `${String(conta(area, 'confirm')).padStart(9)}${String(conta(area, 'prompt')).padStart(9)}` +
      `${String(conta(area)).padStart(9)}`,
  );
}

const listar = area => {
  const daArea = achados.filter(x => x.area === area).sort((x, y) => x.onde.localeCompare(y.onde));
  if (!daArea.length) return;
  console.log(`\nna tela do ${area === 'cliente' ? 'cliente' : 'SuperAdmin'}:`);
  for (const a of daArea) console.log(`  ${a.tipo.padEnd(8)} ${a.onde}`);
};

const naTelaDoCliente = conta('cliente');
const noSuperAdmin = conta('superadmin');

listar('cliente');
// O SuperAdmin só sai com --tudo porque a lista do cliente é a que se olha
// todo dia; despejar as duas sempre faz a que importa rolar pra fora da tela.
// Mas contar sem conseguir listar obriga quem for consertar a sair grepando à
// mão — que é exatamente o erro que este script veio substituir.
if (process.argv.includes('--tudo')) listar('superadmin');

// Duas catracas, não uma. A do cliente existe pelo argumento de ilusão de
// produto: caixinha do navegador entrega que ali não é o produto. A do
// SuperAdmin existe por outro motivo — o que aquelas telas guardam. Redeploy de
// TODOS os tenants, semear dado fictício dentro de um cliente real, ligar o modo
// demonstração (que faz o cliente parar de falar com os leads dele). Julgar pelo
// público deixou essas de fora duas vezes; a pergunta certa é o que a
// confirmação está segurando.
const tetoDe = flag => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : Number(process.argv[i + 1]);
};

const reprovar = (area, quantas, teto) => {
  console.error(
    `\n✗ ${quantas} caixinhas na tela do ${area}, e o teto é ${teto}.\n` +
      `  Use o useConfirmacao (src/hooks/useConfirmacao.tsx) pra confirmação,\n` +
      `  e o toast do sonner pra aviso. Se o teto tiver que subir, suba junto\n` +
      `  com a razão — teto que sobe sozinho não é teto.`,
  );
  process.exit(1);
};

const tetoSuper = tetoDe('--teto-super');
if (tetoSuper !== null) {
  if (noSuperAdmin > tetoSuper) reprovar('SuperAdmin', noSuperAdmin, tetoSuper);
  console.log(`\n✓ ${noSuperAdmin} no SuperAdmin, dentro do teto de ${tetoSuper}.`);
}

const teto = tetoDe('--teto');
if (teto !== null) {
  if (naTelaDoCliente > teto) reprovar('cliente', naTelaDoCliente, teto);
  console.log(`\n✓ ${naTelaDoCliente} na tela do cliente, dentro do teto de ${teto}.`);
}
