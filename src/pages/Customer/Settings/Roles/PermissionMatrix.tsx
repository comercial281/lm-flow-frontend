import { useMemo } from 'react';
import type { PermissionSection } from '@/types/customRoles';
import { CaixaDaJanela } from '@/components/base/janela';

interface Props {
  catalog: PermissionSection[];
  selected: Set<string>;
  onToggle: (permission: string, on: boolean) => void;
  onBulkToggle: (permissions: string[], on: boolean) => void;
  disabled?: boolean;
}

export default function PermissionMatrix({
  catalog,
  selected,
  onToggle,
  onBulkToggle,
  disabled,
}: Props) {
  const sectionStates = useMemo(() => {
    const map: Record<string, { all: boolean; some: boolean; total: number; on: number }> = {};
    for (const section of catalog) {
      const allPerms = section.resources.flatMap(r => r.actions.map(a => a.permission));
      const onCount = allPerms.filter(p => selected.has(p)).length;
      map[section.key] = {
        all: onCount === allPerms.length && allPerms.length > 0,
        some: onCount > 0 && onCount < allPerms.length,
        total: allPerms.length,
        on: onCount,
      };
    }
    return map;
  }, [catalog, selected]);

  return (
    <div className="space-y-3">
      {catalog.map(section => {
        const allPerms = section.resources.flatMap(r => r.actions.map(a => a.permission));
        const state = sectionStates[section.key];
        return (
          <CaixaDaJanela
            key={section.key}
            titulo={section.label}
            acao={
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {state.on}/{state.total}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onBulkToggle(allPerms, true)}
                  className="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  Marcar tudo
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onBulkToggle(allPerms, false)}
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  Limpar
                </button>
              </div>
            }
            corpoClassName="space-y-3 overflow-visible"
          >
            {section.resources.map(resource => {
              const resourcePerms = resource.actions.map(a => a.permission);
              const resOn = resourcePerms.filter(p => selected.has(p)).length;
              return (
                <div key={resource.resource}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {resource.label}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({resOn}/{resourcePerms.length})
                      </span>
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onBulkToggle(resourcePerms, true)}
                        className="text-xs text-primary hover:underline disabled:opacity-50"
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onBulkToggle(resourcePerms, false)}
                        className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
                      >
                        Nenhum
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4">
                    {resource.actions.map(action => {
                      const isOn = selected.has(action.permission);
                      return (
                        <label
                          key={action.permission}
                          className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors ${
                            isOn
                              ? 'bg-primary/10 text-foreground'
                              : 'text-muted-foreground hover:bg-muted/50'
                          } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isOn}
                            disabled={disabled}
                            onChange={e => onToggle(action.permission, e.target.checked)}
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="select-none">{action.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CaixaDaJanela>
        );
      })}
    </div>
  );
}
