// Editor de acessos (entitlements) de um curso/módulo restrito — só admin.
// Admin adiciona por CLIENTE (tenant slug) ou por USUÁRIO (e-mail). Liberdade total.

import { useMemo, useState } from 'react';
import { Plus, X, Building2, User as UserIcon } from 'lucide-react';
import {
  useEntitlements,
  useSetEntitlement,
  useUnsetEntitlement,
  type KnowledgeEntitlement,
} from '@/hooks/useKnowledge';

interface Props {
  targetType: 'course' | 'module';
  targetId: string;
}

export default function EntitlementsEditor({ targetType, targetId }: Props) {
  const { data: all = [] } = useEntitlements();
  const setEnt = useSetEntitlement();
  const unsetEnt = useUnsetEntitlement();

  const [subjectType, setSubjectType] = useState<'tenant' | 'user'>('tenant');
  const [value, setValue] = useState('');

  const rows = useMemo(
    () => all.filter((e) => e.target_type === targetType && e.target_id === targetId),
    [all, targetType, targetId],
  );

  async function add() {
    const v = value.trim();
    if (!v) return;
    await setEnt.mutateAsync({ target_type: targetType, target_id: targetId, subject_type: subjectType, subject_value: v });
    setValue('');
  }

  return (
    <div className="rounded-lg border border-border bg-background/50 p-3 space-y-3">
      <p className="text-[11px] font-semibold text-muted-foreground">
        Quem tem acesso (deixe vazio + tipo "Restrito" = ninguém abre, todos veem bloqueado)
      </p>

      {/* Lista atual */}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rows.map((e: KnowledgeEntitlement) => (
            <span
              key={e.id}
              className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 text-[11px] rounded-full bg-primary/10 text-primary border border-primary/30"
            >
              {e.subject_type === 'tenant' ? <Building2 size={11} /> : <UserIcon size={11} />}
              {e.subject_value}
              <button
                type="button"
                onClick={() => unsetEnt.mutate(e.id)}
                className="p-0.5 hover:text-red-400"
                title="Remover acesso"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Adicionar */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setSubjectType('tenant')}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md ${
              subjectType === 'tenant' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            <Building2 size={11} /> Cliente
          </button>
          <button
            type="button"
            onClick={() => setSubjectType('user')}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md ${
              subjectType === 'user' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            <UserIcon size={11} /> Usuário
          </button>
        </div>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={subjectType === 'tenant' ? 'slug do cliente (ex.: imob-x)' : 'e-mail do usuário'}
          className="flex-1 bg-background border border-border rounded px-2.5 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={add}
          disabled={setEnt.isPending || !value.trim()}
          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
}
