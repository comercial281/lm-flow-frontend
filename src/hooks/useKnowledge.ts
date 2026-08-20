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

// Tipo de acesso: 'free' = todos abrem · 'restricted' = só quem tem entitlement
// (por tenant ou por usuário); os demais veem bloqueado com cadeado + CTA.
export type KnowledgeAccess = 'free' | 'restricted';
export type LockCtaType = 'whatsapp' | 'link' | 'text' | 'none';

export interface KnowledgeCourse {
  id: string;
  titulo: string;
  descricao: string | null;
  capa_url: string | null;
  icone: string | null;
  tenant_slug: string | null; // null = todos veem; slug = só aquele cliente vê
  ordem: number;
  access: KnowledgeAccess;
  lock_cta_type: LockCtaType;
  lock_cta_label: string | null;
  lock_cta_value: string | null;
  lock_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeModule {
  id: string;
  course_id: string | null;
  titulo: string;
  descricao: string | null;
  capa_url: string | null;
  tenant_slug: string | null; // null = global (todos os tenants); slug = só aquele cliente
  ordem: number;
  access: KnowledgeAccess;
  lock_cta_type: LockCtaType;
  lock_cta_label: string | null;
  lock_cta_value: string | null;
  lock_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeEntitlement {
  id: string;
  target_type: 'course' | 'module';
  target_id: string;
  subject_type: 'tenant' | 'user';
  subject_value: string;
  created_at: string;
}

// kind: 'file' = arquivo no bucket (PDF/img) · 'link' = URL externa ·
// 'text' = nota de texto (markdown em `content`, sem arquivo/URL).
export type AttachmentKind = 'file' | 'link' | 'text';

export interface KnowledgeAttachment {
  id: string;
  lesson_id: string;
  name: string;
  url: string;
  storage_path: string | null;
  mime_type: string;
  size_bytes: number;
  kind: AttachmentKind;
  content: string | null;
  ordem: number;
  created_at: string;
}

export interface KnowledgeRating {
  id: string;
  tenant_slug: string;
  lesson_id: string;
  user_ref: string;
  stars: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeLesson {
  id: string;
  module_id: string;
  titulo: string;
  descricao_md: string;
  video_url: string;
  video_provider: 'youtube' | 'vimeo' | 'upload';
  video_id: string;
  storage_path: string | null;
  capa_url: string | null;
  duracao_min: number | null;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface LessonComment {
  id: string;
  tenant_slug: string;
  lesson_id: string;
  user_ref: string;
  author_name: string;
  body: string;
  created_at: string;
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

// Slug do tenant atual (deploy). null/'' = só conteúdo global.
export const TENANT_SLUG = ((import.meta.env.VITE_TENANT_SLUG as string | undefined) ?? '').trim();

// Escopo pras ações do aluno (progresso/avaliação/comentários), que exigem um
// tenant não-vazio. No deploy raiz (admin, sem tenant) cai pra 'root' — assim o
// super-admin consegue testar/usar sem erro. Em deploy de cliente, = TENANT_SLUG.
export const SCOPE_SLUG = TENANT_SLUG || 'root';

// Identidade do usuário logado (auth Rails) — usada pra filtrar progresso e
// marcar autoria de comentários no lado da leitura. A escrita real é carimbada
// pela Edge Function a partir do JWT, nunca confiando no client.
export function getCurrentUserRef(): string {
  return (useAuthStore.getState().currentUser?.email ?? '').toLowerCase().trim();
}

function tenantApiUrl(): string {
  // Usa VITE_AUTH_API_URL (onde vive /api/v1/profile) ou cai pro VITE_API_URL.
  // Espelha a logica do apiAuth (services/core/apiAuth.ts).
  return (
    (import.meta.env.VITE_AUTH_API_URL as string | undefined) ??
    (import.meta.env.VITE_API_URL as string | undefined) ??
    ''
  );
}

async function callAdmin(
  resource:
    | 'categories' | 'docs' | 'modules' | 'lessons' | 'links'
    | 'courses' | 'attachments' | 'entitlements'
    | 'progress' | 'comments' | 'ratings' | 'upload',
  op: 'create' | 'update' | 'delete' | 'set' | 'unset' | 'sign',
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
  return useQuery<KnowledgeModule[]>(`knowledge_modules:${TENANT_SLUG || 'global'}`, async () => {
    let query = supabaseLmHub.from('knowledge_modules').select('*');
    // Mostra módulos globais (tenant_slug null) + os deste cliente específico.
    query = TENANT_SLUG
      ? query.or(`tenant_slug.is.null,tenant_slug.eq.${TENANT_SLUG}`)
      : query.is('tenant_slug', null);
    const { data, error } = await query
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as KnowledgeModule[];
  });
}

export interface ModuleInput {
  titulo: string;
  descricao?: string | null;
  capa_url?: string | null;
  tenant_slug?: string | null;
  course_id?: string | null;
  access?: KnowledgeAccess;
  lock_cta_type?: LockCtaType;
  lock_cta_label?: string | null;
  lock_cta_value?: string | null;
  lock_message?: string | null;
}

export function useCreateModule() {
  return useMutation<ModuleInput, KnowledgeModule>(
    async (input) => {
      const res = (await callAdmin('modules', 'create', {
        titulo: input.titulo,
        descricao: input.descricao ?? null,
        capa_url: input.capa_url ?? null,
        tenant_slug: input.tenant_slug ?? null,
        course_id: input.course_id ?? null,
        access: input.access ?? 'free',
        lock_cta_type: input.lock_cta_type ?? 'whatsapp',
        lock_cta_label: input.lock_cta_label ?? null,
        lock_cta_value: input.lock_cta_value ?? null,
        lock_message: input.lock_message ?? null,
      })) as { data: KnowledgeModule };
      return res.data;
    },
    { successMessage: 'Modulo criado', invalidateKeys: ['knowledge_modules'] },
  );
}

export function useUpdateModule() {
  return useMutation<{ id: string; ordem?: number } & Partial<ModuleInput>, void>(
    async (input) => {
      await callAdmin('modules', 'update', input);
    },
    { invalidateKeys: ['knowledge_modules'] },
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

// Todas as aulas dos módulos visíveis — usado pra calcular progresso no catálogo.
export function useAllLessons(moduleIds: string[]) {
  const key = `knowledge_lessons:all:${moduleIds.slice().sort().join(',')}`;
  return useQuery<KnowledgeLesson[]>(
    key,
    async () => {
      if (moduleIds.length === 0) return [];
      const { data, error } = await supabaseLmHub
        .from('knowledge_lessons')
        .select('*')
        .in('module_id', moduleIds)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data ?? []) as KnowledgeLesson[];
    },
    moduleIds.length > 0,
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

export function useUpdateLesson() {
  return useMutation<
    {
      id: string;
      titulo?: string;
      descricao_md?: string;
      duracao_min?: number | null;
      capa_url?: string | null;
      ordem?: number;
      // Troca de vídeo por embed (YouTube/Vimeo).
      video_url?: string;
      video_provider?: 'youtube' | 'vimeo' | 'upload';
      video_id?: string;
      storage_path?: string | null;
    },
    void
  >(
    async (input) => {
      await callAdmin('lessons', 'update', input);
    },
    { invalidateKeys: ['knowledge_lessons'] },
  );
}

// Troca o vídeo de uma aula existente por um novo arquivo enviado: assina,
// sobe pro bucket e atualiza a aula pra apontar pro novo upload.
export function useReplaceLessonVideo() {
  return useMutation<{ id: string; file: File }, void>(
    async ({ id, file }) => {
      const signed = (await callAdmin('upload', 'sign', {
        filename: file.name,
        tenant_slug: TENANT_SLUG || 'global',
      })) as { data: { path: string; token: string; signedUrl: string; publicUrl: string } };
      const { path, token, publicUrl } = signed.data;

      const { error: upErr } = await supabaseLmHub.storage
        .from('knowledge-videos')
        .uploadToSignedUrl(path, token, file);
      if (upErr) throw upErr;

      await callAdmin('lessons', 'update', {
        id,
        video_url: publicUrl,
        video_provider: 'upload',
        video_id: path,
        storage_path: path,
      });
    },
    { successMessage: 'Vídeo atualizado', invalidateKeys: ['knowledge_lessons'] },
  );
}

// Upload de vídeo direto: pede signed URL à edge (super-admin), sobe o arquivo
// pro bucket knowledge-videos e cria a aula apontando pra URL pública.
export function useUploadLessonVideo() {
  return useMutation<
    {
      module_id: string;
      titulo: string;
      file: File;
      descricao_md?: string;
      duracao_min?: number;
    },
    void
  >(
    async (input) => {
      const signed = (await callAdmin('upload', 'sign', {
        filename: input.file.name,
        tenant_slug: TENANT_SLUG || 'global',
      })) as { data: { path: string; token: string; signedUrl: string; publicUrl: string } };
      const { path, token, publicUrl } = signed.data;

      const { error: upErr } = await supabaseLmHub.storage
        .from('knowledge-videos')
        .uploadToSignedUrl(path, token, input.file);
      if (upErr) throw upErr;

      await callAdmin('lessons', 'create', {
        module_id: input.module_id,
        titulo: input.titulo,
        descricao_md: input.descricao_md ?? '',
        video_url: publicUrl,
        video_provider: 'upload',
        video_id: path,
        storage_path: path,
        duracao_min: input.duracao_min ?? null,
      });
    },
    { successMessage: 'Aula enviada', invalidateKeys: ['knowledge_lessons'] },
  );
}

// Upload de imagem de capa do módulo: pede signed URL à edge (super-admin),
// sobe o arquivo pro bucket knowledge-videos (público, sem restrição de MIME)
// e devolve a URL pública pra usar no capa_url do módulo.
export function useUploadModuleCover() {
  return useMutation<{ file: File }, string>(
    async (input) => {
      const signed = (await callAdmin('upload', 'sign', {
        filename: input.file.name,
        tenant_slug: TENANT_SLUG || 'global',
      })) as { data: { path: string; token: string; signedUrl: string; publicUrl: string } };
      const { path, token, publicUrl } = signed.data;

      const { error: upErr } = await supabaseLmHub.storage
        .from('knowledge-videos')
        .uploadToSignedUrl(path, token, input.file);
      if (upErr) throw upErr;

      return publicUrl;
    },
    { successMessage: 'Capa enviada' },
  );
}

// ── PROGRESSO (por usuário do tenant) ───────────────────────────────────────

// Mapa { lesson_id: true } das aulas concluídas pelo usuário logado.
export function useProgress() {
  const ref = getCurrentUserRef();
  return useQuery<Record<string, boolean>>(
    `knowledge_progress:${SCOPE_SLUG}:${ref}`,
    async () => {
      if (!ref) return {};
      const { data, error } = await supabaseLmHub
        .from('knowledge_lesson_progress_flow')
        .select('lesson_id')
        .eq('tenant_slug', SCOPE_SLUG)
        .eq('user_ref', ref);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((r: { lesson_id: string }) => {
        map[r.lesson_id] = true;
      });
      return map;
    },
  );
}

export function useToggleProgress() {
  return useMutation<{ lesson_id: string; done: boolean }, void>(
    async ({ lesson_id, done }) => {
      await callAdmin('progress', done ? 'set' : 'unset', {
        tenant_slug: SCOPE_SLUG,
        lesson_id,
      });
    },
    { invalidateKeys: ['knowledge_progress'] },
  );
}

// ── COMENTÁRIOS (por aula, escopados ao tenant) ─────────────────────────────

export function useComments(lessonId: string | null) {
  return useQuery<LessonComment[]>(
    `knowledge_comments:${lessonId ?? 'null'}`,
    async () => {
      const { data, error } = await supabaseLmHub
        .from('knowledge_lesson_comments')
        .select('*')
        .eq('tenant_slug', SCOPE_SLUG)
        .eq('lesson_id', lessonId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as LessonComment[];
    },
    lessonId !== null,
  );
}

export function useCreateComment() {
  return useMutation<{ lesson_id: string; body: string }, void>(
    async (input) => {
      await callAdmin('comments', 'create', {
        tenant_slug: SCOPE_SLUG,
        lesson_id: input.lesson_id,
        body: input.body,
      });
    },
    { successMessage: 'Comentário enviado', invalidateKeys: ['knowledge_comments'] },
  );
}

export function useDeleteComment() {
  return useMutation<string, void>(
    async (id) => {
      await callAdmin('comments', 'delete', { id });
    },
    { successMessage: 'Comentário removido', invalidateKeys: ['knowledge_comments'] },
  );
}

// ── CURSOS (nível acima de módulo — cards da home) ──────────────────────────

export function useCourses() {
  return useQuery<KnowledgeCourse[]>(`knowledge_courses:${TENANT_SLUG || 'global'}`, async () => {
    let query = supabaseLmHub.from('knowledge_courses').select('*');
    query = TENANT_SLUG
      ? query.or(`tenant_slug.is.null,tenant_slug.eq.${TENANT_SLUG}`)
      : query.is('tenant_slug', null);
    const { data, error } = await query
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as KnowledgeCourse[];
  });
}

export interface CourseInput {
  titulo: string;
  descricao?: string | null;
  capa_url?: string | null;
  icone?: string | null;
  tenant_slug?: string | null;
  access?: KnowledgeAccess;
  lock_cta_type?: LockCtaType;
  lock_cta_label?: string | null;
  lock_cta_value?: string | null;
  lock_message?: string | null;
  ordem?: number;
}

export function useCreateCourse() {
  return useMutation<CourseInput, KnowledgeCourse>(
    async (input) => {
      const res = (await callAdmin('courses', 'create', {
        titulo: input.titulo,
        descricao: input.descricao ?? null,
        capa_url: input.capa_url ?? null,
        icone: input.icone ?? null,
        tenant_slug: input.tenant_slug ?? null,
        access: input.access ?? 'free',
        lock_cta_type: input.lock_cta_type ?? 'whatsapp',
        lock_cta_label: input.lock_cta_label ?? null,
        lock_cta_value: input.lock_cta_value ?? null,
        lock_message: input.lock_message ?? null,
      })) as { data: KnowledgeCourse };
      return res.data;
    },
    { successMessage: 'Curso criado', invalidateKeys: ['knowledge_courses'] },
  );
}

export function useUpdateCourse() {
  return useMutation<{ id: string } & Partial<CourseInput>, void>(
    async (input) => {
      await callAdmin('courses', 'update', input);
    },
    { invalidateKeys: ['knowledge_courses'] },
  );
}

export function useDeleteCourse() {
  return useMutation<string, void>(
    async (id) => {
      await callAdmin('courses', 'delete', { id });
    },
    { successMessage: 'Curso excluído', invalidateKeys: ['knowledge_courses', 'knowledge_modules'] },
  );
}

// ── ENTITLEMENTS (quem tem acesso a curso/módulo restrito) ──────────────────

// Busca TODOS os entitlements (tabela pequena) — usado pra computar bloqueio.
export function useEntitlements() {
  return useQuery<KnowledgeEntitlement[]>('knowledge_entitlements', async () => {
    const { data, error } = await supabaseLmHub
      .from('knowledge_entitlements')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as KnowledgeEntitlement[];
  });
}

export function useSetEntitlement() {
  return useMutation<
    { target_type: 'course' | 'module'; target_id: string; subject_type: 'tenant' | 'user'; subject_value: string },
    void
  >(
    async (input) => {
      await callAdmin('entitlements', 'create', {
        target_type: input.target_type,
        target_id: input.target_id,
        subject_type: input.subject_type,
        subject_value: input.subject_value.toLowerCase().trim(),
      });
    },
    { successMessage: 'Acesso liberado', invalidateKeys: ['knowledge_entitlements'] },
  );
}

export function useUnsetEntitlement() {
  return useMutation<string, void>(
    async (id) => {
      await callAdmin('entitlements', 'delete', { id });
    },
    { successMessage: 'Acesso removido', invalidateKeys: ['knowledge_entitlements'] },
  );
}

// Retorna true se o alvo está BLOQUEADO para o usuário/tenant atual.
// restricted + sem entitlement (por tenant OU por usuário) = bloqueado.
export function computeLocked(
  target: { access: KnowledgeAccess },
  targetType: 'course' | 'module',
  targetId: string,
  entitlements: KnowledgeEntitlement[],
  tenantSlug: string,
  userRef: string,
): boolean {
  if (target.access !== 'restricted') return false;
  const t = tenantSlug.toLowerCase().trim();
  const u = userRef.toLowerCase().trim();
  return !entitlements.some(
    (e) =>
      e.target_type === targetType &&
      e.target_id === targetId &&
      ((e.subject_type === 'tenant' && t && e.subject_value === t) ||
        (e.subject_type === 'user' && u && e.subject_value === u)),
  );
}

// ── ANEXOS POR AULA ─────────────────────────────────────────────────────────

export function useAttachments(lessonId: string | null) {
  return useQuery<KnowledgeAttachment[]>(
    `knowledge_attachments:${lessonId ?? 'null'}`,
    async () => {
      const { data, error } = await supabaseLmHub
        .from('knowledge_lesson_attachments')
        .select('*')
        .eq('lesson_id', lessonId!)
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as KnowledgeAttachment[];
    },
    lessonId !== null,
  );
}

export function useUploadAttachment() {
  return useMutation<{ lesson_id: string; file: File }, void>(
    async (input) => {
      const signed = (await callAdmin('upload', 'sign', {
        filename: input.file.name,
        tenant_slug: TENANT_SLUG || 'global',
      })) as { data: { path: string; token: string; publicUrl: string } };
      const { path, token, publicUrl } = signed.data;

      const { error: upErr } = await supabaseLmHub.storage
        .from('knowledge-videos')
        .uploadToSignedUrl(path, token, input.file);
      if (upErr) throw upErr;

      await callAdmin('attachments', 'create', {
        lesson_id: input.lesson_id,
        name: input.file.name,
        url: publicUrl,
        storage_path: path,
        mime_type: input.file.type || 'application/octet-stream',
        size_bytes: input.file.size,
        kind: 'file',
      });
    },
    { successMessage: 'Anexo enviado', invalidateKeys: ['knowledge_attachments'] },
  );
}

// Anexo por LINK: guarda só a URL externa (sem arquivo no bucket).
export function useAddLinkAttachment() {
  return useMutation<{ lesson_id: string; name: string; url: string }, void>(
    async (input) => {
      const url = /^https?:\/\//i.test(input.url.trim()) ? input.url.trim() : `https://${input.url.trim()}`;
      await callAdmin('attachments', 'create', {
        lesson_id: input.lesson_id,
        name: input.name.trim() || url,
        url,
        storage_path: null,
        mime_type: 'link',
        size_bytes: 0,
        kind: 'link',
      });
    },
    { successMessage: 'Link adicionado', invalidateKeys: ['knowledge_attachments'] },
  );
}

// Anexo por TEXTO: nota em markdown guardada em `content` (sem arquivo/URL).
export function useAddTextAttachment() {
  return useMutation<{ lesson_id: string; name: string; content: string }, void>(
    async (input) => {
      await callAdmin('attachments', 'create', {
        lesson_id: input.lesson_id,
        name: input.name.trim() || 'Texto',
        url: '',
        storage_path: null,
        mime_type: 'text',
        size_bytes: 0,
        kind: 'text',
        content: input.content,
      });
    },
    { successMessage: 'Texto adicionado', invalidateKeys: ['knowledge_attachments'] },
  );
}

export function useDeleteAttachment() {
  return useMutation<string, void>(
    async (id) => {
      await callAdmin('attachments', 'delete', { id });
    },
    { successMessage: 'Anexo removido', invalidateKeys: ['knowledge_attachments'] },
  );
}

// ── AVALIAÇÃO POR ESTRELAS ──────────────────────────────────────────────────

// Todas as notas de uma aula (do tenant) — média + a nota do usuário atual.
export function useRatings(lessonId: string | null) {
  const ref = getCurrentUserRef();
  return useQuery<{ avg: number; count: number; mine: number | null }>(
    `knowledge_ratings:${SCOPE_SLUG}:${lessonId ?? 'null'}:${ref}`,
    async () => {
      const { data, error } = await supabaseLmHub
        .from('knowledge_lesson_ratings')
        .select('user_ref, stars')
        .eq('tenant_slug', SCOPE_SLUG)
        .eq('lesson_id', lessonId!);
      if (error) throw error;
      const rows = (data ?? []) as { user_ref: string; stars: number }[];
      const count = rows.length;
      const avg = count ? rows.reduce((s, r) => s + r.stars, 0) / count : 0;
      const mine = rows.find((r) => r.user_ref === ref)?.stars ?? null;
      return { avg, count, mine };
    },
    lessonId !== null,
  );
}

export function useSetRating() {
  return useMutation<{ lesson_id: string; stars: number }, void>(
    async ({ lesson_id, stars }) => {
      await callAdmin('ratings', 'set', { tenant_slug: SCOPE_SLUG, lesson_id, stars });
    },
    { invalidateKeys: ['knowledge_ratings'] },
  );
}
