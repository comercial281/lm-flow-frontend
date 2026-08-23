import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
} from '@/components/ui/ds';
import { Loader2, Archive, RotateCcw, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { pipelinesService } from '@/services/pipelines';
import type { PipelineItem } from '@/types/analytics';

interface ArchivedLeadsModalProps {
  open: boolean;
  onClose: () => void;
  pipelineId: string;
  /** Chamado após desarquivar pra o board recarregar o lead que voltou. */
  onUnarchived?: () => void;
}

// Nome cru às vezes vem como telefone; cai no melhor candidato.
function itemName(item: PipelineItem): string {
  const c = item.contact || (item.conversation as any)?.contact;
  const name = c?.name as string | undefined;
  if (name && !/^[+\d\s()\-@.]+$/.test(name)) return name;
  return c?.phone_number || name || 'Lead';
}

export default function ArchivedLeadsModal({ open, onClose, pipelineId, onUnarchived }: ArchivedLeadsModalProps) {
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const res = await pipelinesService.getPipelineItems(pipelineId, { archived: 'true', per_page: 200 });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleUnarchive = useCallback(async (item: PipelineItem) => {
    setBusyId(item.id);
    try {
      await pipelinesService.unarchiveItem(item.pipeline_id, item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success('Lead desarquivado');
      onUnarchived?.();
    } catch {
      toast.error('Erro ao desarquivar');
    } finally {
      setBusyId(null);
    }
  }, [onUnarchived]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Archive className="h-4 w-4" />
            Leads arquivados
          </DialogTitle>
          <DialogDescription className="text-xs">
            Leads tirados do board. Desarquive pra trazer de volta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum lead arquivado.</p>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{itemName(item)}</div>
                    {(item.contact?.phone_number || (item.conversation as any)?.contact?.phone_number) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {item.contact?.phone_number || (item.conversation as any)?.contact?.phone_number}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 shrink-0"
                    disabled={busyId === item.id}
                    onClick={() => handleUnarchive(item)}
                  >
                    {busyId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    Desarquivar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
