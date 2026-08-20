import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, ToggleLeft, AlertCircle, Check } from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Switch, Label,
} from '@/components/ui/ds';
import clientInstancesService, {
  ClientInstance, FeatureCatalogItem,
} from '@/services/clientInstances/clientInstancesService';

interface Props {
  instance: ClientInstance;
  open: boolean;
  onClose: () => void;
  onSaved?: (updated: ClientInstance) => void;
}

// Cada key aqui = um grupo do catálogo (config/lm_flow_features.yml no backend),
// e cada grupo = um MENU real do CRM. O label é o nome do menu como o cliente vê.
const GROUP_LABELS: Record<string, string> = {
  dashboard:           'Dashboard',
  conversations:       'Conversas',
  contacts:            'Contatos',
  pipelines:           'Pipelines',
  properties:          'Imóveis',
  visits:              'Agenda de Visitas',
  proposals:           'Propostas',
  contracts:           'Contratos',
  property_capture:    'Captação',
  property_interests:  'Interesses',
  ai_agents:           'Robôs e Integrações',
  channels:            'Canais',
  automations:         'Automações',
  marketplace:         'Marketplace',
  disparos:            'Disparos',
  espaco:              'Espaço',
  tutorials:           'Tutoriais',
  settings:            'Configurações (sem menu próprio)',
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
    // allSettled pra que falha em uma chamada não derrube o modal inteiro
    // (cenário comum em janela de deploy: backend velho ainda no ar).
    const [catSettled, instSettled] = await Promise.allSettled([
      clientInstancesService.featureCatalog(),
      clientInstancesService.get(instance.id),
    ]);

    let cat: FeatureCatalogItem[] = [];
    if (catSettled.status === 'fulfilled') {
      const raw = catSettled.value?.data?.data;
      if (Array.isArray(raw)) cat = raw;
    }

    let resolved: Record<string, boolean> = {};
    if (instSettled.status === 'fulfilled') {
      resolved = instSettled.value?.data?.data?.resolved_features ?? {};
    }

    // Se não veio catálogo do backend (deploy em andamento), monta default
    // ON a partir do que tiver de resolved — modal abre exibindo mensagem.
    if (cat.length === 0 && Object.keys(resolved).length > 0) {
      cat = Object.keys(resolved).map(key => ({ key, label: key, group: 'menus' }));
    }

    setCatalog(cat);
    // Default ON pra qualquer key do catálogo ausente em resolved.
    const filled = cat.reduce(
      (acc, f) => ({ ...acc, [f.key]: resolved[f.key] !== false }),
      {} as Record<string, boolean>
    );
    setFeatures(filled);

    if (catSettled.status === 'rejected' || instSettled.status === 'rejected') {
      const reason = catSettled.status === 'rejected' ? catSettled.reason : (instSettled as any).reason;
      setError(`Backend ainda subindo o deploy — ${pickError(reason)}. Recarregue em ~1min.`);
    }

    setLoading(false);
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
            Liga ou desliga o que o cliente vê no CRM dele. Cada seção é um menu do CRM: o toggle
            destacado com <span className="text-primary font-medium">menu inteiro</span> esconde o
            menu todo, os de baixo são funções específicas dentro dele. Mudanças propagam quando o
            cliente recarrega a página (cache de até 5 minutos).
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
                    {(() => {
                      // Convenção do catálogo: o primeiro item de cada grupo cuja key bate
                      // com o nome do grupo é o toggle do MENU INTEIRO (ex: group "conversations"
                      // → item key "conversations"). O resto são funções de dentro do menu.
                      const menuToggle = items.find(i => i.key === group);
                      const subItems = menuToggle ? items.filter(i => i.key !== group) : items;

                      const renderRow = (item: FeatureCatalogItem, opts: { indent?: boolean; border?: boolean; strong?: boolean }) => {
                        const on = features[item.key] !== false;
                        const id = `feat-${item.key}`;
                        return (
                          <div
                            key={item.key}
                            className={`flex items-center justify-between py-2 pr-3 ${
                              opts.indent ? 'pl-7' : 'pl-3'
                            } ${opts.border ? 'border-t' : ''} ${opts.strong ? 'bg-muted/40' : ''}`}
                          >
                            <Label htmlFor={id} className={`cursor-pointer flex-1 text-sm ${opts.strong ? 'font-medium' : ''}`}>
                              {item.label}
                              {opts.strong && (
                                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                  menu inteiro
                                </span>
                              )}
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
                      };

                      return (
                        <>
                          {menuToggle && renderRow(menuToggle, { strong: true })}
                          {subItems.map((item, idx) =>
                            renderRow(item, {
                              indent: !!menuToggle,
                              border: menuToggle ? true : idx > 0,
                            })
                          )}
                        </>
                      );
                    })()}
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
