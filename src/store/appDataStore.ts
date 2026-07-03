import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { accountService } from '@/services/account/accountService';
import usersService from '@/services/users/usersService';
import InboxesService from '@/services/channels/inboxesService';
import { labelsService } from '@/services/contacts/labelsService';
import TeamsService from '@/services/teams/teamsService';
import type { Account } from '@/types/settings';
import type { User } from '@/types/users';
import type { Inbox } from '@/types/channels/inbox';
import type { Label } from '@/types/settings';
import type { Team } from '@/types/users';

interface AppDataState {
  // Data
  account: Account | null;
  agents: User[];
  inboxes: Inbox[];
  labels: Label[];
  teams: Team[];

  // Loading states
  isLoadingAccount: boolean;
  isLoadingAgents: boolean;
  isLoadingInboxes: boolean;
  isLoadingLabels: boolean;
  isLoadingTeams: boolean;

  // Cache timestamps
  initialized: boolean;
  lastFetchTimestamps: {
    account: number;
    agents: number;
    inboxes: number;
    labels: number;
    teams: number;
  };

  // Actions
  fetchAccount: (forceRefresh?: boolean) => Promise<void>;
  fetchAgents: (forceRefresh?: boolean) => Promise<void>;
  fetchInboxes: (forceRefresh?: boolean) => Promise<void>;
  fetchLabels: (forceRefresh?: boolean) => Promise<void>;
  fetchTeams: (forceRefresh?: boolean) => Promise<void>;
  initializeAppData: () => Promise<void>;
  initializeAppDataDeferred: (
    options?: {
      agents?: boolean;
      inboxes?: boolean;
      labels?: boolean;
      teams?: boolean;
      forceRefresh?: boolean;
    },
  ) => Promise<void>;
  removeInbox: (inboxId: string) => void;
  addInbox: (inbox: Inbox) => void;
  clearAppData: () => void;
}

// Cache duration - 15 minutes
const CACHE_DURATION = 15 * 60 * 1000;

type ResourceKey = 'account' | 'agents' | 'inboxes' | 'labels' | 'teams';

// Dedupe de requests em voo: componentes que montam juntos compartilham a
// mesma Promise em vez de disparar chamadas idênticas em paralelo.
const inflight: Partial<Record<ResourceKey, Promise<void>>> = {};

function dedupe(key: ResourceKey, run: () => Promise<void>): Promise<void> {
  const existing = inflight[key];
  if (existing) return existing;
  const promise = run().finally(() => {
    delete inflight[key];
  });
  inflight[key] = promise;
  return promise;
}

// Persistido em sessionStorage: F5 pinta as telas na hora com o dado anterior
// (o TTL de 15min decide se re-busca). sessionStorage é por origem/aba, então
// cada tenant (subdomínio) tem o seu — sem vazar dado entre clientes.
export const useAppDataStore = create<AppDataState>()(persist((set, get) => {
  // Cache por timestamp (não por "lista não-vazia"): resposta vazia também
  // é resposta — tenant sem teams não pode re-buscar em toda montagem.
  const isFresh = (key: ResourceKey) => Date.now() - get().lastFetchTimestamps[key] < CACHE_DURATION;

  const stamp = (key: ResourceKey) => ({
    ...get().lastFetchTimestamps,
    [key]: Date.now(),
  });

  return {
    account: null,
    agents: [],
    inboxes: [],
    labels: [],
    teams: [],

    isLoadingAccount: false,
    isLoadingAgents: false,
    isLoadingInboxes: false,
    isLoadingLabels: false,
    isLoadingTeams: false,

    initialized: false,
    lastFetchTimestamps: {
      account: 0,
      agents: 0,
      inboxes: 0,
      labels: 0,
      teams: 0,
    },

    fetchAccount: async (forceRefresh = false) => {
      if (!forceRefresh && get().account && isFresh('account')) return;

      return dedupe('account', async () => {
        set({ isLoadingAccount: true });
        try {
          const result = await accountService.getAccount();
          set({
            account: result,
            isLoadingAccount: false,
            lastFetchTimestamps: stamp('account'),
          });
        } catch (error) {
          console.error('Failed to fetch account:', error);
          set({ isLoadingAccount: false });
          throw error;
        }
      });
    },

    fetchAgents: async (forceRefresh = false) => {
      if (!forceRefresh && isFresh('agents')) return;

      return dedupe('agents', async () => {
        set({ isLoadingAgents: true });
        try {
          const response = await usersService.getUsers();
          set({
            agents: response.data,
            isLoadingAgents: false,
            lastFetchTimestamps: stamp('agents'),
          });
        } catch (error) {
          console.error('Failed to fetch agents:', error);
          set({ isLoadingAgents: false });
          throw error;
        }
      });
    },

    fetchInboxes: async (forceRefresh = false) => {
      if (!forceRefresh && isFresh('inboxes')) return;

      return dedupe('inboxes', async () => {
        set({ isLoadingInboxes: true });
        try {
          const inboxes = await InboxesService.list();
          set({
            inboxes: inboxes.data,
            isLoadingInboxes: false,
            lastFetchTimestamps: stamp('inboxes'),
          });
        } catch (error) {
          console.error('Failed to fetch inboxes:', error);
          set({ isLoadingInboxes: false });
          throw error;
        }
      });
    },

    fetchLabels: async (forceRefresh = false) => {
      if (!forceRefresh && isFresh('labels')) return;

      return dedupe('labels', async () => {
        set({ isLoadingLabels: true });
        try {
          const response = await labelsService.getLabels();
          set({
            labels: response.data,
            isLoadingLabels: false,
            lastFetchTimestamps: stamp('labels'),
          });
        } catch (error) {
          console.error('Failed to fetch labels:', error);
          set({ isLoadingLabels: false });
          throw error;
        }
      });
    },

    fetchTeams: async (forceRefresh = false) => {
      if (!forceRefresh && isFresh('teams')) return;

      return dedupe('teams', async () => {
        set({ isLoadingTeams: true });
        try {
          const response = await TeamsService.getTeams();
          set({
            teams: response.data,
            isLoadingTeams: false,
            lastFetchTimestamps: stamp('teams'),
          });
        } catch (error) {
          console.error('Failed to fetch teams:', error);
          set({ isLoadingTeams: false });
          throw error;
        }
      });
    },

    initializeAppData: async () => {
      set({ initialized: true });
      await get().initializeAppDataDeferred();
    },

    initializeAppDataDeferred: async (options = {}) => {
      const forceRefresh = options.forceRefresh ?? false;
      const shouldLoadAgents = options.agents ?? true;
      const shouldLoadInboxes = options.inboxes ?? true;
      const shouldLoadLabels = options.labels ?? true;
      const shouldLoadTeams = options.teams ?? true;

      const tasks: Promise<void>[] = [];
      tasks.push(get().fetchAccount(forceRefresh));
      if (shouldLoadAgents) tasks.push(get().fetchAgents(forceRefresh));
      if (shouldLoadInboxes) tasks.push(get().fetchInboxes(forceRefresh));
      if (shouldLoadLabels) tasks.push(get().fetchLabels(forceRefresh));
      if (shouldLoadTeams) tasks.push(get().fetchTeams(forceRefresh));

      await Promise.allSettled(tasks);
    },

    removeInbox: inboxId => {
      set(state => ({
        inboxes: state.inboxes.filter(inbox => inbox.id !== inboxId),
      }));
    },

    addInbox: inbox => {
      set(state => ({
        inboxes: [...state.inboxes, inbox],
      }));
    },

    clearAppData: () => {
      set({
        account: null,
        agents: [],
        inboxes: [],
        labels: [],
        teams: [],
        initialized: false,
        lastFetchTimestamps: {
          account: 0,
          agents: 0,
          inboxes: 0,
          labels: 0,
          teams: 0,
        },
      });
    },
  };
}, {
  name: 'lmflow:app-data:v1',
  storage: createJSONStorage(() => sessionStorage),
  // Persistir só os dados + timestamps (nunca os flags de loading/initialized).
  partialize: state => ({
    account: state.account,
    agents: state.agents,
    inboxes: state.inboxes,
    labels: state.labels,
    teams: state.teams,
    lastFetchTimestamps: state.lastFetchTimestamps,
  }),
}));
