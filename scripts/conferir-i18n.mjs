#!/usr/bin/env node
// Confere que toda chave de tradução usada no código existe no pt-BR, e que
// não voltou nenhum idioma além dele.
//
// POR QUE ISTO EXISTE
// O sistema tinha 6 idiomas e o padrão de reserva era o INGLÊS. Chave ausente
// no pt-BR renderizava em inglês — sem erro, sem aviso, sem quebrar lint nem
// teste. Cresceu até 117 chaves ausentes e 545 com o texto inglês dentro do
// arquivo português, e ninguém viu porque NADA reprovava.
//
// Agora existe um idioma só. Sem esta checagem, o mesmo problema volta em
// outra forma: chave escrita errada no código vira a PRÓPRIA CHAVE aparecendo
// na tela do cliente ("chat.header.titlee" no lugar do texto).
//
// O QUE ELE CONFERE
//   1. Só existe o pt-BR em src/i18n/locales/
//   2. Toda chave literal passada pro t() existe no arquivo do namespace
//
// O QUE ELE NÃO CONFERE, DE PROPÓSITO
//   Chave montada em tempo de execução (`t(\`x.${y}\`)`, t(variavel)) é
//   ignorada — não dá pra resolver estaticamente, e chutar geraria alarme
//   falso. Alarme falso crônico é pior que não ter checagem: todo mundo
//   aprende a ignorar.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(RAIZ, 'src');
const LOCALES = join(SRC, 'i18n', 'locales');
const IDIOMA = 'pt-BR';

// ── 1. Só pode existir o pt-BR ───────────────────────────────────────────────
const idiomas = readdirSync(LOCALES).filter(d => statSync(join(LOCALES, d)).isDirectory());
const intrusos = idiomas.filter(d => d !== IDIOMA);
if (intrusos.length) {
  console.error(`\n✗ Voltou idioma além do ${IDIOMA}: ${intrusos.join(', ')}`);
  console.error(`  O produto é pt-BR only. Se a decisão mudou, mude também este script`);
  console.error(`  E o fallbackLng em src/i18n/config.ts — reserva em inglês foi o que`);
  console.error(`  produziu ~450 pontos de inglês na tela sem ninguém perceber.\n`);
  process.exit(1);
}

// ── 2. Carrega todas as chaves do pt-BR ──────────────────────────────────────
const achatar = (obj, prefixo = '') => {
  const saida = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const caminho = prefixo ? `${prefixo}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const sub of achatar(v, caminho)) saida.add(sub);
    } else {
      saida.add(caminho);
    }
  }
  return saida;
};

const chaves = new Map(); // namespace -> Set de chaves
for (const arquivo of readdirSync(join(LOCALES, IDIOMA))) {
  if (!arquivo.endsWith('.json')) continue;
  const ns = arquivo.slice(0, -5);
  const json = JSON.parse(readFileSync(join(LOCALES, IDIOMA, arquivo), 'utf8'));
  chaves.set(ns, achatar(json));
}

// ── 3. Varre o código ────────────────────────────────────────────────────────
const andar = (dir, arquivos = []) => {
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'locales' || entrada === 'node_modules') continue;
    const cheio = join(dir, entrada);
    if (statSync(cheio).isDirectory()) andar(cheio, arquivos);
    else if (/\.(ts|tsx)$/.test(entrada) && !/\.(spec|test)\.tsx?$/.test(entrada)) arquivos.push(cheio);
  }
  return arquivos;
};

// useLanguage('ns') / useTranslation('ns') / useMultipleTranslations(['a','b'])
const RE_NS_SIMPLES = /use(?:Language|Translation)\(\s*['"]([a-zA-Z]+)['"]/g;
const RE_NS_MULTI = /useMultipleTranslations\(\s*\[([^\]]*)\]/g;
// t('chave') e t('ns:chave') — só literal, nunca template
const RE_T = /\bt\(\s*['"]([a-zA-Z][a-zA-Z0-9_.:-]*)['"]/g;

const faltando = [];
let conferidas = 0;

for (const arquivo of andar(SRC)) {
  const texto = readFileSync(arquivo, 'utf8');
  const rel = relative(RAIZ, arquivo);

  const nsDoArquivo = new Set();
  for (const m of texto.matchAll(RE_NS_SIMPLES)) nsDoArquivo.add(m[1]);
  for (const m of texto.matchAll(RE_NS_MULTI)) {
    for (const n of m[1].matchAll(/['"]([a-zA-Z]+)['"]/g)) nsDoArquivo.add(n[1]);
  }

  for (const m of texto.matchAll(RE_T)) {
    const bruto = m[1];
    let ns, chave;

    if (bruto.includes(':')) {
      [ns, chave] = bruto.split(':');
      if (!chaves.has(ns)) continue; // não é chave de tradução, é outra coisa com dois-pontos
    } else {
      // Sem namespace explícito: só dá pra resolver se o arquivo declarou UM.
      if (nsDoArquivo.size !== 1) continue;
      ns = [...nsDoArquivo][0];
      chave = bruto;
    }

    if (!chaves.has(ns)) continue;
    conferidas++;
    if (!chaves.get(ns).has(chave)) faltando.push({ rel, ns, chave });
  }
}

// ── 4. Resultado ─────────────────────────────────────────────────────────────
if (faltando.length) {
  console.error(`\n✗ ${faltando.length} chave(s) usada(s) no código e ausente(s) do ${IDIOMA}:\n`);
  const porArquivo = new Map();
  for (const f of faltando) {
    if (!porArquivo.has(f.rel)) porArquivo.set(f.rel, []);
    porArquivo.get(f.rel).push(f);
  }
  for (const [rel, itens] of porArquivo) {
    console.error(`  ${rel}`);
    for (const i of itens) console.error(`     ${i.ns}:${i.chave}`);
  }
  console.error(`\n  Cada uma destas aparece na tela do cliente como a PRÓPRIA CHAVE.`);
  console.error(`  Adicione em src/i18n/locales/${IDIOMA}/<namespace>.json.\n`);
  process.exit(1);
}

console.log(`✓ i18n: ${conferidas} chaves conferidas, todas presentes no ${IDIOMA}`);
console.log(`  (${chaves.size} namespaces, ${[...chaves.values()].reduce((s, c) => s + c.size, 0)} chaves no total)`);
