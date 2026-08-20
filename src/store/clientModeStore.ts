import { create } from 'zustand';

// ─────────────────────────────────────────────────────────────────────────────
// MODO CLIENTE (super-admin)
//
// Permite ao super-admin operar o painel INTEIRO dentro de um cliente (tenant)
// sem sair do host raiz (app.lmflow.com.br). Funciona sobrepondo, apenas nas
// instâncias axios do APP:
//   - o token: usa o token SSO cunhado DENTRO do schema do cliente
//   - o X-Tenant: usa o slug do cliente
//
// A sessão RAIZ (authStore + apiAuth: login/refresh/validate) fica intacta —
// o token raiz continua guardado no authStore e volta a valer ao sair do modo.
// ─────────────────────────────────────────────────────────────────────────────

export interface ClientModeTenant {
  id: string;
  slug: string;
  schema: string;
  name: string;
}

interface ClientModeState {
  active: boolean;
  tenant: ClientModeTenant | null;
  token: string | null;
  enter: (tenant: ClientModeTenant, token: string) => void;
  exit: () => void;
}

const STORAGE_KEY = 'lm_client_mode';

function readPersisted(): { tenant: ClientModeTenant; token: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.tenant?.slug && parsed?.token) return parsed;
    return null;
  } catch {
    return null;
  }
}

const persisted = readPersisted();

export const useClientModeStore = create<ClientModeState>(set => ({
  active: !!persisted,
  tenant: persisted?.tenant ?? null,
  token: persisted?.token ?? null,

  enter: (tenant, token) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tenant, token }));
    } catch {
      // localStorage indisponível — mantém só em memória
    }
    set({ active: true, tenant, token });
  },

  exit: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignora
    }
    set({ active: false, tenant: null, token: null });
  },
}));

// Getters SEM React — usados pelos interceptors axios (fora de componente).

export function getClientModeToken(): string | null {
  const s = useClientModeStore.getState();
  return s.active && s.token ? s.token : null;
}

export function getClientModeSlug(): string | null {
  const s = useClientModeStore.getState();
  return s.active && s.tenant ? s.tenant.slug : null;
}

export function isClientModeActive(): boolean {
  return useClientModeStore.getState().active;
}
