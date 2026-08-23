#!/usr/bin/env node
// Garante que toda featureKey / clientToggleKey / useFeature('...') usada no
// front tem par no catálogo do backend (config/lm_flow_features.yml, repo
// lm-flow, servido publicamente em /api/public/v1/tenant_features).
//
// Roda no build (ver "build" em package.json). Se um menu novo ganhar
// featureKey/clientToggleKey sem a entrada correspondente no catálogo, o
// deploy FALHA aqui — em vez de ir pro ar com o menu escondido de todo
// cliente, em silêncio, sem ninguém perceber (já aconteceu: contracts,
// disparos, espaco ficaram órfãos assim por meses).
//
// Fail-CLOSED só quando a checagem RODOU e achou uma chave de verdade faltando.
// Fail-OPEN (avisa, não derruba o build) se a API estiver fora do ar — rede
// instável na hora do deploy não pode travar o time.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const CATALOG_URL = 'https://api.lmflow.com.br/api/public/v1/tenant_features?slug=mybroker';
const GATE_KEY_RE = /(?:featureKey|clientToggleKey)\s*:\s*['"]([a-z0-9_]+)['"]/g;
const HOOK_KEY_RE = /useFeature\(\s*['"]([a-z0-9_]+)['"]\s*\)/g;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

function usedKeys() {
  const found = new Map(); // key -> file relativo (primeira ocorrência, pra apontar onde corrigir)
  for (const file of walk(SRC_DIR)) {
    const text = readFileSync(file, 'utf8');
    for (const re of [GATE_KEY_RE, HOOK_KEY_RE]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        if (!found.has(m[1])) found.set(m[1], file.replace(SRC_DIR, 'src'));
      }
    }
  }
  return found;
}

async function catalogKeys() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(CATALOG_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const catalog = body?.data?.catalog;
    if (!Array.isArray(catalog)) throw new Error('resposta sem data.catalog[]');
    return new Set(catalog.map(c => c.key));
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const used = usedKeys();

  let known;
  try {
    known = await catalogKeys();
  } catch (e) {
    console.warn(`[audit-feature-catalog] não consegui checar o catálogo ao vivo (${e.message}) — pulando, build continua.`);
    return;
  }

  const missing = [...used.keys()].filter(k => !known.has(k)).sort();
  if (missing.length === 0) {
    console.log(`[audit-feature-catalog] ok — ${used.size} chaves usadas no front, todas no catálogo.`);
    return;
  }

  console.error('\n[audit-feature-catalog] FALHOU — chave(s) usada(s) em featureKey/clientToggleKey/useFeature sem entrada no catálogo do backend:');
  for (const k of missing) console.error(`  - ${k}  (${used.get(k)})`);
  console.error('\nAdicione a chave em config/lm_flow_features.yml (repo lm-flow, branch saas-multitenant) antes de mergear.');
  console.error('Sem isso o menu correspondente fica escondido de TODO cliente, sempre, sem aviso.\n');
  // process.exitCode (não process.exit) deixa o processo terminar sozinho depois
  // que os handles do fetch/timer drenam — process.exit() nesse ponto crasha no
  // Windows (libuv assertion em async.c) com um handle de abort ainda fechando.
  process.exitCode = 1;
}

main();
