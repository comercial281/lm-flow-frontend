// Hooks da Central de Conhecimento global do Tutorial LM Flow.
// Leitura: supabaseLmHub (anon key + RLS publico).
// Escrita: Edge Function `tutorial-admin` no projeto Supabase do LM Hub.
//
// Sem React Query (nao instalado no LM Flow). Cache module-level simples +
// listeners por queryKey pra refetch quando invalidado por mutation.

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  supabaseLmHub,
  LMHUB_CONFIGURED,
  LMHUB_SUPABASE_URL,
} from '@/lib/supabaseLmHub';
import { useAuthStore } from '@/store/authStore';

// ── Types ──────────────────────────────────────────────────────────────────

export interface KnowledgeCategory {
  id: string;
  parent_id: string | null;
  nome: string;
  slug: string;
  icone: string;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDoc {
  id: string;
  category_id: string | null;
  titulo: string;
  slug: string;
  content_md: string;
  autor_id: string | null;
  pinned: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeModule {
  id: string;
  titulo: string;
  descricao: string | null;
  capa_url: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeLesson {
  id: string;
  module_id: string;
  titulo: string;
  descricao_md: string;
  video_url: string;
  video_provider: 'youtube' | 'vimeo';
  video_id: string;
  duracao_min: number | null;
  ordem: number;
  created_at: string;
  updated_at: string;
}

// ── Cache global + invalidation bus ────────────────────────────────────────

type Listener = () => void;
const listeners: Map<string, Set<Listener>> = new Map();

function subscribe(key: string, fn: Listener): () => void {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
  return () => {
    listeners.get(key)?.delete(fn);
  };
}

function invalidate(prefix: string): void {
  for (const [key, set] of listeners.entries()) {
    if (key.startsWith(prefix)) set.forEach((fn) => fn());
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'Erro inesperado';
}

function tenantApiUrl(): string {
  return (import.meta.env.VITE_API_URL as string | undefined) ?? '';
}

async function callAdmin(
  resource: 'categories' | 'docs' | 'modules' | 'lessons' | 'links',
  op: 'create' | 'update' | 'delete',
  payload: Record<string, unknown>,
): Promise<unknown> {
  const token = useAuthStore.getState().accessToken;
  if (!token) throw new Error('Sessao expirada — faca login novamente.');
  const apiUrl = tenantApiUrl();
  if (!apiUrl) throw new Error('VITE_API_URL nao configurada no tenant.');

  const res = await fetch(`${LMHUB_SUPABASE_URL}/functions/v1/tutorial-admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Tenant-API-URL': apiUrl,
    },
    body: JSON.stringify({ resource, op, payload }),
  });

  if (!res.ok) {
    let body: { error?: string } = {};
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    if (res.status === 403) throw new Error('Apenas o super-admin pode editar.');
    if (res.status === 401) throw new Error('Autenticacao falhou.');
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const data = await res.json().catch(() => null);
  return data;
}

// ── Generic query hook ─────────────────────────────────────────────────────

interface QueryState<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
}

function useQuery<T>(key: string, fetcher: () => Promise<T>, enabled = true): QueryState<T> & { refetch: () => void } {
  const [state, setState] = useState<QueryState<T>>({
    data: undefined,
    isLoading: enabled,
    error: null,
  });

  const run = useCallback(async () => {
    if (!enabled || !LMHUB_CONFIGURED) {
      setState({ data: undefined, isLoading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const data = await fetcher();
      setState({ data, isLoading: false, error: null });
    } catch (e) {
      setState({ data: undefined, isLoading: false, error: e as Error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  useEffect(() => {
    run();
    return subscribe(key, run);
  }, [key, run]);

  return { ...state, refetch: run };
}

// ── Generic mutation hook ──────────────────────────────────────────────────

interface MutationState {
  isPending: boolean;
}

function useMutation<TInput, TOutput>(
  fn: (input: TInput) => Promise<TOutput>,
  opts: { onSuccess?: (out: TOutput, input: TInput) => void; successMessage?: string; invalidateKeys?: string[] } = {},
) {
  const [state, setState] = useState<MutationState>({ isPending: false });
  const mutateAsync = useCallback(
    async (input: TInput): Promise<TOutput> => {
      setState({ isPending: true });
      try {
        const out = await fn(input);
        opts.invalidateKeys?.forEach((k) => invalidate(k));
        opts.onSuccess?.(out, input);
        if (opts.successMessage) toast.success(opts.successMessage);
        return out;
      } catch (e) {
        toast.error(errMsg(e));
        throw e;
      } finally {
        setState({ isPending: false });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return { ...state, mutateAsync, mutate: (input: TInput) => void mutateAsync(input).catch(() => {}) };
}

// ── CATEGORIAS ─────────────────────────────────────────────────────────────

export function useCategories() {
  return useQuery<KnowledgeCategory[]>('knowledge_categories', async () => {
    const { data, error } = await supabaseLmHub
      .from('knowledge_categories')
      .select('*')
      .order('ordem', { ascending: true })
      .order('nome', { ascending: true });
    if (error) throw error;
    return (data ?? []) as KnowledgeCategory[];
  });
}

export function useCreateCategory() {
  return useMutation<{ nome: string; parent_id?: string | null; icone?: string }, KnowledgeCategory>(
    async (input) => {
      const slug = slugify(input.nome);
      const res = (await callAdmin('categories', 'create', {
        nome: input.nome,
        slug,
        parent_id: input.parent_id ?? null,
        icone: input.icone ?? 'Folder',
      })) as { data: KnowledgeCategory };
      return res.data;
    },
    { successMessage: 'Categoria criada', invalidateKeys: ['knowledge_categories'] },
  );
}

export function useUpdateCategory() {
  return useMutation<{ id: string; nome?: string; icone?: string; ordem?: number }, void>(
    async (input) => {
      const patch: Record<string, unknown> = { id: input.id };
      if (input.nome !== undefined) {
        patch.nome = input.nome;
        patch.slug = slugify(input.nome);
      }
      if (input.icone !== undefined) patch.icone = input.icone;
      if (input.ordem !== undefined) patch.ordem = input.ordem;
      await callAdmin('categories', 'update', patch);
    },
    { invalidateKeys: ['knowledge_categories'] },
  );
}

export function useDeleteCategory() {
  return useMutation<string, void>(
    async (id) => {
      await callAdmin('categories', 'delete', { id });
    },
    { successMessage: 'Categoria excluida', invalidateKeys: ['knowledge_categories'] },
  );
}

// ── DOCS ───────────────────────────────────────────────────────────────────

export function useDocs(categoryId: string | null) {
  return useQuery<KnowledgeDoc[]>(
    `knowledge_docs:${categoryId ?? 'null'}`,
    async () => {
      const { data, error } = await supabaseLmHub
        .from('knowledge_docs')
        .select('*')
        .eq('category_id', categoryId!)
        .order('pinned', { ascending: false })
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as KnowledgeDoc[];
    },
    categoryId !== null,
  );
}

export function useCreateDoc() {
  return useMutation<{ category_id: string; titulo: string; content_md?: string }, KnowledgeDoc>(
    async (input) => {
      const slug = slugify(input.titulo) || `doc-${Date.now()}`;
      const res = (await callAdmin('docs', 'create', {
        category_id: input.category_id,
        titulo: input.titulo,
        slug,
        content_md: input.content_md ?? '',
      })) as { data: KnowledgeDoc };
      return res.data;
    },
    { successMessage: 'Doc criado', invalidateKeys: ['knowledge_docs'] },
  );
}

export function useUpdateDoc() {
  return useMutation<{ id: string; titulo?: string; content_md?: string; pinned?: boolean }, void>(
    async (input) => {
      await callAdmin('docs', 'update', input);
    },
    { invalidateKeys: ['knowledge_docs'] },
  );
}

export function useDeleteDoc() {
  return useMutation<string, void>(
    async (id) => {
      await callAdmin('docs', 'delete', { id });
    },
    { successMessage: 'Doc excluido', invalidateKeys: ['knowledge_docs'] },
  );
}

// ── MODULOS ────────────────────────────────────────────────────────────────

export function useModules() {
  return useQuery<KnowledgeModule[]>('knowledge_modules', async () => {
    const { data, error } = await supabaseLmHub
      .from('knowledge_modules')
      .select('*')
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as KnowledgeModule[];
  });
}

export function useCreateModule() {
  return useMutation<{ titulo: string; descricao?: string; capa_url?: string }, KnowledgeModule>(
    async (input) => {
      const res = (await callAdmin('modules', 'create', {
        titulo: input.titulo,
        descricao: input.descricao ?? null,
        capa_url: input.capa_url ?? null,
      })) as { data: KnowledgeModule };
      return res.data;
    },
    { successMessage: 'Modulo criado', invalidateKeys: ['knowledge_modules'] },
  );
}

export function useDeleteModule() {
  return useMutation<string, void>(
    async (id) => {
      await callAdmin('modules', 'delete', { id });
    },
    { successMessage: 'Modulo excluido', invalidateKeys: ['knowledge_modules', 'knowledge_lessons'] },
  );
}

// ── AULAS ──────────────────────────────────────────────────────────────────

export function useLessons(moduleId: string | null) {
  return useQuery<KnowledgeLesson[]>(
    `knowledge_lessons:${moduleId ?? 'null'}`,
    async () => {
      const { data, error } = await supabaseLmHub
        .from('knowledge_lessons')
        .select('*')
        .eq('module_id', moduleId!)
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as KnowledgeLesson[];
    },
    moduleId !== null,
  );
}

import { parseVideoUrl } from '@/pages/Customer/Tutorials/_internal/lib';

export function useCreateLesson() {
  return useMutation<{ module_id: string; titulo: string; video_url: string; descricao_md?: string; duracao_min?: number }, void>(
    async (input) => {
      const parsed = parseVideoUrl(input.video_url);
      if (!parsed) throw new Error('URL invalida — apenas YouTube ou Vimeo');
      await callAdmin('lessons', 'create', {
        module_id: input.module_id,
        titulo: input.titulo,
        descricao_md: input.descricao_md ?? '',
        video_url: input.video_url,
        video_provider: parsed.provider,
        video_id: parsed.id,
        duracao_min: input.duracao_min ?? null,
      });
    },
    { successMessage: 'Aula adicionada', invalidateKeys: ['knowledge_lessons'] },
  );
}

export function useDeleteLesson() {
  return useMutation<string, void>(
    async (id) => {
      await callAdmin('lessons', 'delete', { id });
    },
    { successMessage: 'Aula removida', invalidateKeys: ['knowledge_lessons'] },
  );
}
