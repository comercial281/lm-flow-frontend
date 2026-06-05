import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, ToggleLeft, AlertCircle, Check } from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Switch, Label,
} from '@evoapi/design-system';
import clientInstancesService, {
  ClientInstance, FeatureCatalogItem,
} from '@/services/clientInstances/clientInstancesService';

interface Props {
  instance: ClientInstance;
  open: boolean;
  onClose: () => void;
  onSaved?: (updated: ClientInstance) => void;
}

const GROUP_LABELS: Record<string, string> = {
  menus:    'Menus principais',
  settings: 'Configurações de produto',
};

function pickError(e: any): string {
  const d = e?.response?.data;
  return d?.error ?? d?.errors?.join?.(', ') ?? d?.message ?? e?.message ?? 'Erro inesperado';
}

export default function FeaturesModal({ instance, open, onClose, onSaved }: Props) {
  const [catalog, setCatalog] = useState<FeatureCatalogItem[]>([]);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [catRes, instRes] = await Promise.all([
        clientInstancesService.featureCatalog(),
        clientInstancesService.get(instance.id),
      ]);
      const cat = catRes.data.data;
      const inst = instRes.data.data;
      setCatalog(cat);
      // Estado inicial: resolved_features tem TODAS as keys com default ON.
      const resolved = inst.resolved_features
        ?? cat.reduce((acc, f) => ({ ...acc, [f.key]: true }), {} as Record<string, boolean>);
      setFeatures({ ...resolved });
    } catch (e) {
      setError(pickError(e));
    } finally {
      setLoading(false);
    }
  }, [instance.id]);

  useEffect(() => {
    if (open) load();
    else {
      setCatalog([]); setFeatures({}); setError(''); setSavedAt(null);
    }
  }, [open, load]);

  const grouped = useMemo(() => {
    const map = new Map<string, FeatureCatalogItem[]>();
    for (const item of catalog) {
      const g = item.group || 'outros';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(item);
    }
    return Array.from(map.entries());
  }, [catalog]);

  const totalOn = useMemo(
    () => catalog.filter(f => features[f.key] !== false).length,
    [catalog, features]
  );

  const toggle = (key: string, val: boolean) =>
    setFeatures(prev => ({ ...prev, [key]: val }));

  const setAll = (val: boolean, group?: string) => {
    setFeatures(prev => {
      const next = { ...prev };
      for (const f of catalog) {
        if (!group || f.group === group) next[f.key] = val;
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      const res = await clientInstancesService.updateFeatures(instance.id, features);
      onSaved?.(res.data.data);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch (e) {
      setError(pickError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ToggleLeft className="h-5 w-5 text-primary" />
            Funções de {instance.name}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Liga ou desliga o que o cliente vê no CRM dele. Mudanças propagam quando o cliente
            recarrega a página (cache de até 5 minutos).
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando funções...
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between bg-muted rounded-md px-3 py-2 text-xs">
              <span>
                <strong>{totalOn}</strong> de <strong>{catalog.length}</strong> funções ativas
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setAll(true)}
                >Ligar tudo</button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  className="text-destructive hover:underline"
                  onClick={() => setAll(false)}
                >Desligar tudo</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 py-2 -mx-1 px-1">
              {grouped.map(([group, items]) => (
                <section key={group}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-foreground">
                      {GROUP_LABELS[group] ?? group}
                    </h4>
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => setAll(true, group)}
                      >ligar grupo</button>
                      <span className="text-muted-foreground">·</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setAll(false, group)}
                      >desligar grupo</button>
                    </div>
                  </div>

                  <div className="space-y-1 rounded-md border bg-card">
                    {items.map((item, idx) => {
                      const on = features[item.key] !== false;
                      const id = `feat-${item.key}`;
                      return (
                        <div
                          key={item.key}
                          className={`flex items-center justify-between px-3 py-2 ${
                            idx > 0 ? 'border-t' : ''
                          }`}
                        >
                          <Label htmlFor={id} className="cursor-pointer flex-1 text-sm">
                            {item.label}
                            <span className="ml-2 text-[10px] text-muted-foreground font-mono">
                              {item.key}
                            </span>
                          </Label>
                          <Switch
                            id={id}
                            checked={on}
                            onCheckedChange={(v: boolean) => toggle(item.key, v)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-red-50 dark:bg-red-900/20 rounded p-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </>
        )}

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Fechar
          </Button>
          <Button onClick={save} disabled={loading || saving}>
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
            ) : savedAt ? (
              <><Check className="h-4 w-4 mr-2" /> Salvo</>
            ) : (
              'Salvar alterações'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
