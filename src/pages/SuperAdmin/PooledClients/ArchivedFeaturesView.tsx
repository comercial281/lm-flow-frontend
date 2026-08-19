import { useCallback, useEffect, useState } from 'react';
import { Archive, AlertCircle, Loader2 } from 'lucide-react';
import { Switch, Label } from '@/components/ui/ds';
import api from '@/services/core/api';

interface CatalogItem {
  key: string;
  label: string;
  group: string;
}

// Convenção do catálogo (config/lm_flow_features.yml, backend): o primeiro item
// de cada grupo tem key === group — é o toggle do MENU INTEIRO. Aqui só faz
// sentido arquivar menus inteiros, não funções soltas de dentro deles.
function menuLevelItems(catalog: CatalogItem[]): CatalogItem[] {
  return catalog.filter(item => item.key === item.group);
}

function pickError(e: any): string {
  const d = e?.response?.data;
  return d?.error ?? d?.message ?? e?.message ?? 'Erro inesperado';
}

export default function ArchivedFeaturesView() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [archivedKeys, setArchivedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/super/pooled_tenants/archived_features');
      setCatalog(res.data?.data?.catalog ?? []);
      setArchivedKeys(res.data?.data?.keys ?? []);
    } catch (e) {
      setError(pickError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (key: string, archived: boolean) => {
    setSavingKey(key); setError('');
    const prev = archivedKeys;
    // Otimista: some/aparece na hora, reverte se o backend recusar.
    setArchivedKeys(archived ? [...prev, key] : prev.filter(k => k !== key));
    try {
      const res = await api.patch('/super/pooled_tenants/archived_features', { key, archived });
      setArchivedKeys(res.data?.data?.keys ?? prev);
    } catch (e) {
      setArchivedKeys(prev);
      setError(pickError(e));
    } finally {
      setSavingKey(null);
    }
  };

  const items = menuLevelItems(catalog);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-start gap-3 mb-4">
        <Archive className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Menus arquivados</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Um menu arquivado some do CRM pra TODO MUNDO — cliente e você (super-admin) —
            até você desarquivar aqui. É pra tirar do ar telas ainda em desenvolvimento sem
            precisar mexer em código nem fazer deploy. Diferente do toggle de Funções por
            cliente: aquele liga/desliga por cliente com o recurso pronto; este tira do
            sistema inteiro enquanto não está pronto.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
        </div>
      ) : (
        <>
        <p className="text-[11px] text-muted-foreground mb-2">Interruptor ligado = arquivado (menu fora do ar).</p>
        <div className="space-y-1 rounded-md border bg-card">
          {items.map((item, idx) => {
            const archived = archivedKeys.includes(item.key);
            const id = `archive-${item.key}`;
            return (
              <div
                key={item.key}
                className={`flex items-center justify-between px-3 py-2.5 ${idx > 0 ? 'border-t' : ''}`}
              >
                <Label htmlFor={id} className="cursor-pointer flex-1 text-sm">
                  {item.label}
                  <span className="ml-2 text-[10px] text-muted-foreground font-mono">{item.key}</span>
                  {archived && (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                      arquivado
                    </span>
                  )}
                </Label>
                {savingKey === item.key ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Switch
                    id={id}
                    checked={archived}
                    onCheckedChange={(v: boolean) => toggle(item.key, v)}
                  />
                )}
              </div>
            );
          })}
        </div>
        </>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-red-50 dark:bg-red-900/20 rounded p-2 mt-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
