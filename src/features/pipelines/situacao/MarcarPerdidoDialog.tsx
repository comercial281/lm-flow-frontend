// src/features/pipelines/situacao/MarcarPerdidoDialog.tsx
// "Por que este lead foi perdido?" — motivo obrigatório da lista viva
// (Listas da casa, Motivos de perda; só os ativos) e um comentário livre. Os
// dois vão para Observações e Histórico pelo servidor (spec funil §3.3).
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, Label, Textarea,
} from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import EmptyState from '@/components/base/EmptyState';
import { listOptionsService, type ListOption } from '@/services/listOptions/listOptionsService';

interface MarcarPerdidoDialogProps {
  aberto: boolean;
  nomeDoLead: string;
  salvando: boolean;
  aoFechar: () => void;
  aoConfirmar: (motivoId: string, comentario: string) => void;
}

export default function MarcarPerdidoDialog({ aberto, nomeDoLead, salvando, aoFechar, aoConfirmar }: MarcarPerdidoDialogProps) {
  const [motivos, setMotivos] = useState<ListOption[] | null>(null);
  const [erro, setErro] = useState(false);
  const [motivoId, setMotivoId] = useState('');
  const [comentario, setComentario] = useState('');

  const carregar = useCallback(async () => {
    setErro(false);
    setMotivos(null);
    try {
      const lista = await listOptionsService.list('loss_reasons');
      setMotivos(lista.filter(o => o.active));
    } catch {
      setErro(true);
    }
  }, []);

  useEffect(() => {
    if (!aberto) return;
    setMotivoId('');
    setComentario('');
    void carregar();
  }, [aberto, carregar]);

  return (
    <Dialog open={aberto} onOpenChange={o => { if (!o && !salvando) aoFechar(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Por que este lead foi perdido?</DialogTitle>
        <DialogDescription>
          {nomeDoLead} sai do follow-up, a IA para de responder e ele sai dos alertas. A conversa continua aberta.
          O motivo e o comentário vão para Observações e Histórico.
        </DialogDescription>

        {erro ? (
          <EmptyState tipo="erro" aoTentarDeNovo={() => { void carregar(); }} />
        ) : motivos === null ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando os motivos" />
          </div>
        ) : motivos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum motivo de perda ativo. Um gestor cadastra em Minha imobiliária › Listas.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="motivo-da-perda">Motivo</Label>
              <Seletor id="motivo-da-perda" value={motivoId} onChange={e => setMotivoId(e.target.value)} className="w-full">
                <option value="" disabled>Escolha o motivo</option>
                {motivos.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </Seletor>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="comentario-da-perda">Comentário</Label>
              <Textarea
                id="comentario-da-perda"
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                placeholder="Ex.: vai decidir depois das férias"
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={aoFechar} disabled={salvando}>Cancelar</Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!motivoId || salvando}
            onClick={() => aoConfirmar(motivoId, comentario)}
          >
            {salvando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Marcar como perdido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
