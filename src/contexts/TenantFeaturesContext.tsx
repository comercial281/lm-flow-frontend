import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';

// Estado de features que cada tenant frontend lê do master no boot.
// Lê de:
//   VITE_MASTER_API_URL  → URL base do backend master (ex: https://api-master.up.railway.app)
//   VITE_TENANT_SLUG     → slug do tenant (ex: meu-imovel-imob)
//
// Quando qualquer dos dois estiver ausente OU a chamada falhar, cai pra
// fallback `all-on` — nunca esconde nada. Isso garante que tenants legados
// (sem env var) continuam funcionando 100% até serem migrados.

const CACHE_KEY_PREFIX = 'lm_flow_tenant_features:';
const CACHE_TTL_MS     = 5 * 60 * 1000; // 5 min
const FETCH_TIMEOUT_MS = 4000;

export interface TenantFeaturesState {
  // map de feature key → bool. Chave AUSENTE = ON por default.
  features: Record<string, boolean>;
  // true enquanto ainda não terminou a primeira tentativa de fetch.
  loading: boolean;
  // último motivo do fallback, útil pra debug. Ex: 'no_env', 'fetch_failed', 'ok'.
  source: 'ok' | 'cache' | 'fallback' | 'no_env' | 'fetch_failed';
}

const DEFAULT_STATE: TenantFeaturesState = {
  features: {},
  loading: true,
  source: 'fallback',
};

const TenantFeaturesContext = createContext<TenantFeaturesState>(DEFAULT_STATE);

interface CachedPayload {
  ts: number;
  features: Record<string, boolean>;
}

function readCache(slug: string): CachedPayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + slug);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPayload;
    if (!parsed.ts || (Date.now() - parsed.ts) > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(slug: string, features: Record<string, boolean>) {
  try {
    localStorage.setItem(
      CACHE_KEY_PREFIX + slug,
      JSON.stringify({ ts: Date.now(), features })
    );
  } catch {
    // ignore quota errors
  }
}

async function fetchFeatures(masterUrl: string, slug: string): Promise<Record<string, boolean> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `${masterUrl.replace(/\/+$/, '')}/api/public/v1/tenant_features?slug=${encodeURIComponent(slug)}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const body = await res.json();
    const features = body?.data?.features;
    if (features && typeof features === 'object') return features as Record<string, boolean>;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function TenantFeaturesProvider({ children }: { children: ReactNode }) {
  const masterUrl = (import.meta.env.VITE_MASTER_API_URL as string | undefined)?.trim();
  const slug      = (import.meta.env.VITE_TENANT_SLUG as string | undefined)?.trim();

  const [state, setState] = useState<TenantFeaturesState>(() => {
    if (!masterUrl || !slug) {
      return { features: {}, loading: false, source: 'no_env' };
    }
    const cached = readCache(slug);
    if (cached) {
      return { features: cached.features, loading: false, source: 'cache' };
    }
    return { features: {}, loading: true, source: 'fallback' };
  });

  useEffect(() => {
    if (!masterUrl || !slug) return;
    // Sempre revalida em background, mesmo com cache, pra puxar mudança nova.
    let cancelled = false;
    (async () => {
      const fresh = await fetchFeatures(masterUrl, slug);
      if (cancelled) return;
      if (fresh) {
        writeCache(slug, fresh);
        setState({ features: fresh, loading: false, source: 'ok' });
      } else {
        // Só sobrescreve pra fetch_failed se NÃO havia cache (caso contrário mantém cache exibido).
        setState(prev => prev.source === 'cache'
          ? prev
          : { features: {}, loading: false, source: 'fetch_failed' });
      }
    })();
    return () => { cancelled = true; };
  }, [masterUrl, slug]);

  const value = useMemo(() => state, [state]);

  return (
    <TenantFeaturesContext.Provider value={value}>
      {children}
    </TenantFeaturesContext.Provider>
  );
}

export function useTenantFeatures(): TenantFeaturesState {
  return useContext(TenantFeaturesContext);
}

// Helper canônico: feature ligada quando NÃO está explicitamente false.
// Ausência da chave => ON (mesma regra do backend ClientInstance#feature_enabled?).
export function useFeature(key?: string): boolean {
  const { features } = useTenantFeatures();
  if (!key) return true;
  return features[key] !== false;
}
