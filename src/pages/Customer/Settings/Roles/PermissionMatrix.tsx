import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PermissionSection } from '@/types/customRoles';

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
          <details
            key={section.key}
            className="rounded-lg border border-border bg-card"
            open={state.on > 0}
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40">
              <div className="flex items-center gap-3">
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                <span className="font-semibold text-foreground">{section.label}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {state.on}/{state.total}
                </span>
              </div>
              <div
                className="flex items-center gap-2"
                onClick={e => e.stopPropagation()}
              >
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
            </summary>

            <div className="border-t border-border p-4 space-y-3">
              {section.resources.map(resource => {
                const resourcePerms = resource.actions.map(a => a.permission);
                const resOn = resourcePerms.filter(p => selected.has(p)).length;
                return (
                  <div key={resource.resource} className="rounded-md bg-muted/30 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {resource.label}
                        <span className="ml-2 text-xs text-muted-foreground">
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
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                      {resource.actions.map(action => {
                        const isOn = selected.has(action.permission);
                        return (
                          <label
                            key={action.permission}
                            className={`flex cursor-pointer items-center gap-2 rounded border p-2 text-sm transition-colors ${
                              isOn
                                ? 'border-primary/40 bg-primary/10 text-foreground'
                                : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
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
            </div>
          </details>
        );
      })}
    </div>
  );
}
