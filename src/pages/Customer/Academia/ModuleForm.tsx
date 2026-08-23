// Form de criar/editar MÓDULO (admin). Vincula a um curso, capa, escopo,
// bloqueio + CTA e (ao editar) acessos por cliente/usuário.

import { useState } from 'react';
import { X } from 'lucide-react';
import {
  useCreateModule,
  useUpdateModule,
  useCourses,
  TENANT_SLUG,
  type KnowledgeModule,
} from '@/hooks/useKnowledge';
import CoverPicker from './CoverPicker';
import LockConfigFields, { type LockConfig } from './LockConfigFields';
import EntitlementsEditor from './EntitlementsEditor';

export default function ModuleForm({
  editing,
  defaultCourseId,
  onClose,
}: {
  editing: KnowledgeModule | null;
  defaultCourseId?: string | null;
  onClose: () => void;
}) {
  const createModule = useCreateModule();
  const updateModule = useUpdateModule();
  const { data: courses = [] } = useCourses();

  const [titulo, setTitulo] = useState(editing?.titulo ?? '');
  const [descricao, setDescricao] = useState(editing?.descricao ?? '');
  const [capaUrl, setCapaUrl] = useState(editing?.capa_url ?? '');
  const [courseId, setCourseId] = useState<string>(editing?.course_id ?? defaultCourseId ?? '');
  const [scope, setScope] = useState<'global' | 'tenant'>(editing?.tenant_slug ? 'tenant' : 'global');
  const [lock, setLock] = useState<LockConfig>({
    access: editing?.access ?? 'free',
    lock_cta_type: editing?.lock_cta_type ?? 'whatsapp',
    lock_cta_label: editing?.lock_cta_label ?? '',
    lock_cta_value: editing?.lock_cta_value ?? '',
    lock_message: editing?.lock_message ?? '',
  });

  const busy = createModule.isPending || updateModule.isPending;
  const canScopeTenant = Boolean(TENANT_SLUG);

  async function submit() {
    if (!titulo.trim()) return;
    const base = {
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      capa_url: capaUrl.trim() || null,
      course_id: courseId || null,
      tenant_slug: scope === 'tenant' && canScopeTenant ? TENANT_SLUG : null,
      access: lock.access,
      lock_cta_type: lock.lock_cta_type,
      lock_cta_label: lock.lock_cta_label.trim() || null,
      lock_cta_value: lock.lock_cta_value.trim() || null,
      lock_message: lock.lock_message.trim() || null,
    };
    if (editing) await updateModule.mutateAsync({ id: editing.id, ...base });
    else await createModule.mutateAsync(base);
    onClose();
  }

  return (
    <div className="mb-6 bg-card border border-border rounded-xl p-4 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{editing ? 'Editar módulo' : 'Novo módulo'}</p>
        <button onClick={onClose} type="button" className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      <input
        autoFocus
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Nome do módulo (ex.: Biblioteca de Formatos)"
        className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
      />
      <textarea
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Descrição (opcional)"
        rows={2}
        className="w-full bg-background border border-border rounded px-3 py-2 text-sm resize-y"
      />

      <div>
        <p className="text-[11px] text-muted-foreground mb-1">Curso</p>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
        >
          <option value="">Geral (sem curso)</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.titulo}</option>
          ))}
        </select>
      </div>

      <CoverPicker value={capaUrl} onChange={setCapaUrl} />

      <div>
        <p className="text-[11px] text-muted-foreground mb-1">Quem vê este módulo</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScope('global')}
            className={`px-3 py-1.5 text-[11px] rounded-lg border ${
              scope === 'global' ? 'bg-primary/15 text-primary border-primary/40' : 'border-border text-muted-foreground'
            }`}
          >
            Global (todos os clientes)
          </button>
          <button
            type="button"
            onClick={() => canScopeTenant && setScope('tenant')}
            disabled={!canScopeTenant}
            className={`px-3 py-1.5 text-[11px] rounded-lg border disabled:opacity-40 ${
              scope === 'tenant' ? 'bg-primary/15 text-primary border-primary/40' : 'border-border text-muted-foreground'
            }`}
            title={canScopeTenant ? '' : 'Disponível só dentro do painel de um cliente'}
          >
            Só este cliente{TENANT_SLUG ? ` (${TENANT_SLUG})` : ''}
          </button>
        </div>
      </div>

      <LockConfigFields value={lock} onChange={(patch) => setLock((v) => ({ ...v, ...patch }))} />

      {editing && lock.access === 'restricted' && (
        <EntitlementsEditor targetType="module" targetId={editing.id} />
      )}
      {!editing && lock.access === 'restricted' && (
        <p className="text-[11px] text-muted-foreground">
          Salve o módulo primeiro pra liberar clientes/usuários específicos.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground" type="button">
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="px-3 py-1.5 text-xs text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-50 rounded-lg"
          type="button"
        >
          {busy ? 'Salvando...' : editing ? 'Salvar' : 'Criar módulo'}
        </button>
      </div>
    </div>
  );
}
