#!/usr/bin/env node
// Confere, DEPOIS do `vite build`, que o site no domínio do cliente não carrega
// nada da sessão do CRM.
//
// POR QUE ISTO EXISTE
// No domínio do cliente (www.imobiliaria.com.br) sobe só o site
// (src/mainDoSite.tsx): sem login, sem token, sem websocket. É o que deixa o
// GTM e os códigos do cliente rodarem ali sem ler a sessão de ninguém. Basta
// UMA página pública importar algo do CRM (um service, o authStore, um hook de
// chat) para o código de sessão voltar para o pacote do site, e o defeito é
// MUDO: o site continua abrindo igual. Só o pacote mostra.
//
// COMO ELE LÊ
// Pelos arquivos do `dist/`, sem manifest:
//   1. o `dist/index.html` diz qual é a entrada (`/assets/main-*.js`);
//   2. na entrada, o `import("./mainDoSite-*.js")` é o pedaço do site;
//   3. a partir dele, segue TODO import estático, dinâmico e a lista de
//      pré-carga do Vite (`__vite__mapDeps`), em qualquer pedaço alcançado;
//   4. a entrada é a única exceção: dela só vale o import ESTÁTICO. O
//      `import("./mainDoSistema")` dela só roda nos endereços do sistema (é a
//      decisão pelo endereço, em src/main.tsx), e o site importa a entrada só
//      pelo carregador do Vite e pela recarga após deploy.
// Em cada pedaço alcançado procura os termos proibidos.
//
// TRAVA CEGA
// Os mesmos passos a partir do `mainDoSistema` TÊM que achar algum termo. Se
// não acharem, os nomes mudaram e esta trava não pega mais nada: reprova
// também, para a lista ser atualizada.
//
// USO
//   node scripts/conferir-dominio-limpo.mjs              confere o dist/
//   node scripts/conferir-dominio-limpo.mjs --dist DIR   confere outra pasta

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROIBIDOS = ['access_token', 'refresh_token', 'validityCheck', 'ActionCable'];

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

const ESTATICO = /(?:\bfrom|\bimport)\s*["']\.\/([\w.-]+\.js)["']/g;
const DINAMICO = /\bimport\(\s*["']\.\/([\w.-]+\.js)["']\s*\)/g;
const PRE_CARGA = /["']assets\/([\w.-]+\.js)["']/g;

const nomes = (texto, re) => [...texto.matchAll(re)].map(m => m[1]);

/** Os pedaços alcançados a partir de `inicio`. `entrada`: dela só o estático. */
export function alcancados(assets, inicio, entrada) {
  const vistos = new Set();
  const fila = [inicio];
  while (fila.length) {
    const nome = fila.shift();
    if (vistos.has(nome)) continue;
    const arquivo = join(assets, nome);
    if (!existsSync(arquivo)) throw new Error(`o pedaço ${nome} é importado mas não existe em ${assets}`);
    vistos.add(nome);
    const texto = readFileSync(arquivo, 'utf8');
    const proximos = nome === entrada
      ? nomes(texto, ESTATICO)
      : [...nomes(texto, ESTATICO), ...nomes(texto, DINAMICO), ...nomes(texto, PRE_CARGA)];
    for (const p of proximos) if (!vistos.has(p)) fila.push(p);
  }
  return [...vistos];
}

/** [{ pedaco, termo }] dos termos proibidos nos pedaços. */
export function termosEm(assets, pedacos) {
  const achados = [];
  for (const pedaco of pedacos) {
    const texto = readFileSync(join(assets, pedaco), 'utf8');
    for (const termo of PROIBIDOS) if (texto.includes(termo)) achados.push({ pedaco, termo });
  }
  return achados;
}

function falhar(msg) {
  console.error(`\n✗ conferir-dominio-limpo: ${msg}`);
  process.exit(1);
}

export function conferir(dist) {
  const assets = join(dist, 'assets');
  const html = join(dist, 'index.html');
  if (!existsSync(html)) falhar(`não achei ${html}. Rode depois do vite build.`);
  const entrada = /<script\b[^>]*\bsrc=["']\/assets\/([\w.-]+\.js)["']/.exec(readFileSync(html, 'utf8'))?.[1];
  if (!entrada) falhar('não achei o script de entrada no dist/index.html.');
  const textoDaEntrada = readFileSync(join(assets, entrada), 'utf8');
  const dinamicos = nomes(textoDaEntrada, DINAMICO);
  const site = dinamicos.find(n => /^mainDoSite-/.test(n));
  const sistema = dinamicos.find(n => /^mainDoSistema-/.test(n));
  if (!site || !sistema) {
    falhar(
      `a entrada ${entrada} não importa o mainDoSite e o mainDoSistema por import().\n` +
        '  O src/main.tsx precisa decidir pelo endereço qual dos dois sobe.',
    );
  }

  const doSite = alcancados(assets, site, entrada);
  const achados = termosEm(assets, doSite);
  if (achados.length) {
    const linhas = achados.map(a => `    ${a.termo.padEnd(14)} em assets/${a.pedaco}`).join('\n');
    falhar(
      `o site no domínio do cliente carrega código de sessão do CRM:\n${linhas}\n` +
        '  Alguma página pública (src/pages/Public, src/features/siteBuilder/public, src/routes/SiteDoDominio)\n' +
        '  passou a importar algo do CRM (service com o interceptor, authStore, sessão, websocket).\n' +
        '  Ache o import e troque por uma peça sem dependência do CRM.',
    );
  }

  const doSistema = alcancados(assets, sistema, entrada);
  if (!termosEm(assets, doSistema).length) {
    falhar(
      `nenhum dos termos (${PROIBIDOS.join(', ')}) aparece nem no CRM.\n` +
        '  A trava ficou cega: atualize a lista PROIBIDOS com os nomes de hoje.',
    );
  }

  console.log(`✓ site do domínio limpo: ${doSite.length} pedaços conferidos, sem ${PROIBIDOS.join(', ')}.`);
}

const executado = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (executado) {
  const i = process.argv.indexOf('--dist');
  conferir(i === -1 ? join(RAIZ, 'dist') : process.argv[i + 1]);
}
