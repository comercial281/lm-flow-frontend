#!/usr/bin/env node
// Mantém o catálogo de Funções (super-admin) em dia com o menu REAL do CRM,
// sozinho, a cada deploy do front — sem precisar editar
// config/lm_flow_features.yml nem fazer deploy do backend.
//
// Causa raiz que isso resolve: o catálogo era editado à mão (YAML no repo
// lm-flow) e o front muda o tempo todo — a cada menu removido/adicionado o
// catálogo ficava dessincronizado até alguém notar e corrigir manualmente
// (aconteceu por dias: recursos removidos do CRM continuavam poluindo o
// painel de Funções; recursos novos não tinham controle nenhum lá).
//
// O QUE FAZ:
// 1. Varre o front (mesmo scanner do audit-feature-catalog.mjs) por toda
//    featureKey/clientToggleKey/useFeature('...') em uso HOJE.
// 2. Busca o catálogo ao vivo do backend.
// 3. Remove do catálogo qualquer chave que não é mais usada em lugar nenhum
//    do código (a causa do "removi e não sumiu").
// 4. Acrescenta uma entrada pra toda chave usada que ainda não tem catálogo
//    (a causa do "adicionei e não apareceu") — label/grupo são um chute
//    razoável (nome da chave "humanizado", grupo = a própria chave); dá pra
//    ajustar o texto depois pela tela Funções, o importante é a chave
//    aparecer e ser controlável.
// 5. Se o catálogo mudou, manda a versão nova pro backend
//    (POST /super/pooled_tenants/sync_feature_catalog).
//
// FAIL-OPEN sempre: se faltar o token, a API estiver fora do ar, ou qualquer
// coisa der errado, só avisa e deixa o build seguir — sincronizar catálogo
// é conveniência, não pode travar deploy. O audit-feature-catalog.mjs (que
// roda logo depois, no mesmo "build") continua sendo o freio de segurança
// que TRAVA o build se sobrar uma chave sem catálogo mesmo depois desta
// tentativa de sync (ex: token não configurado neste projeto Vercel).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const API_BASE = 'https://api.lmflow.com.br/api/v1';
const CATALOG_URL = 'https://api.lmflow.com.br/api/public/v1/tenant_features?slug=mybroker';
const SYNC_URL = `${API_BASE}/super/pooled_tenants/sync_feature_catalog`;
// Mesmo valor do X-Service-Token da API LM Flow (ver Empresa/🔐 SECRETS no vault).
// Configurado como env var de BUILD no projeto Vercel (não VITE_*, então nunca
// entra no bundle do cliente — só existe dentro deste script Node no build).
const SERVICE_TOKEN = process.env.LM_FLOW_SYNC_TOKEN;

const GATE_KEY_RE = /(?:featureKey|clientToggleKey)\s*:\s*['"]([a-z0-9_]+)['"]/g;
// useClientToggle = semântica "default OFF, a Leal Mídia libera cliente a
// cliente" (ver TenantFeaturesContext). Precisa ser varrido junto com o
// useFeature, senão a chave gateada por ele nunca entra no catálogo — e no
// deploy seguinte o sync REMOVE a chave por achar que ninguém a usa.
const HOOK_KEY_RE = /(?:useFeature|useClientToggle)\(\s*['"]([a-z0-9_]+)['"]\s*\)/g;

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
  const keys = new Set();
  for (const file of walk(SRC_DIR)) {
    const text = readFileSync(file, 'utf8');
    for (const re of [GATE_KEY_RE, HOOK_KEY_RE]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) keys.add(m[1]);
    }
  }
  return keys;
}

function humanize(key) {
  return key
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function fetchJson(url, opts, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  if (!SERVICE_TOKEN) {
    console.warn('[sync-feature-catalog] LM_FLOW_SYNC_TOKEN não configurado neste projeto Vercel — pulando sync (audit ainda protege o build).');
    return;
  }

  const used = usedKeys();

  const catRes = await fetchJson(CATALOG_URL).catch(e => ({ ok: false, error: e.message }));
  if (!catRes.ok) {
    console.warn(`[sync-feature-catalog] não consegui ler o catálogo ao vivo (${catRes.status ?? catRes.error}) — pulando sync.`);
    return;
  }
  const liveCatalog = catRes.body?.data?.catalog;
  if (!Array.isArray(liveCatalog)) {
    console.warn('[sync-feature-catalog] resposta sem data.catalog[] — pulando sync.');
    return;
  }

  const kept = liveCatalog.filter(item => used.has(item.key));
  const droppedKeys = liveCatalog.filter(item => !used.has(item.key)).map(item => item.key);

  const keptKeys = new Set(kept.map(item => item.key));
  const newKeys = [...used].filter(k => !keptKeys.has(k)).sort();
  const added = newKeys.map(key => ({ key, label: humanize(key), group: key }));

  const nextCatalog = [...kept, ...added];

  if (droppedKeys.length === 0 && added.length === 0) {
    console.log(`[sync-feature-catalog] ok — catálogo já em dia (${nextCatalog.length} chaves).`);
    return;
  }

  if (droppedKeys.length) console.log(`[sync-feature-catalog] removendo ${droppedKeys.length} chave(s) sem uso: ${droppedKeys.join(', ')}`);
  if (added.length) console.log(`[sync-feature-catalog] adicionando ${added.length} chave(s) nova(s): ${added.map(a => a.key).join(', ')}`);

  const syncRes = await fetchJson(SYNC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Service-Token': SERVICE_TOKEN },
    body: JSON.stringify({ catalog: nextCatalog }),
  }).catch(e => ({ ok: false, error: e.message }));

  if (!syncRes.ok) {
    console.warn(`[sync-feature-catalog] falhou ao salvar (${syncRes.status ?? syncRes.error}) — catálogo NÃO atualizado, audit vai travar o build se sobrar chave faltando.`);
    return;
  }

  console.log(`[sync-feature-catalog] sincronizado — ${nextCatalog.length} chaves no catálogo agora.`);
}

main().catch(e => {
  console.warn(`[sync-feature-catalog] erro inesperado (${e.message}) — pulando sync, build continua.`);
});
