import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ds';
import { Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import {
  brokerAssignmentsService,
  BrokerAssignmentDetail,
} from '@/services/roletaConfig/brokerAssignmentsService';
import { useAccountUsers } from '@/hooks/useAccountUsers';

// Tirar um lead da roleta.
//
// Antes disto não existia forma de fazer isso pela tela: a única maneira de
// encerrar uma oferta era trocar o responsável na mão — e ela não cobria os dois
// pedidos mais comuns da gestão. Parar o prazo deixando o lead com o MESMO
// corretor não funcionava (o sistema lê "atribuir para quem já tem a oferta"
// como escolha da própria roleta e não encerra nada), e tirar o lead da roleta
// sem entregá-lo a ninguém não era possível de jeito nenhum.
//
// Por isso o destino é escolhido aqui, na hora: sem responsável (o lead volta a
// ficar visível para o time, igual a quando a roleta se esgota) ou com um
// corretor, que passa a ser dono sem precisar aceitar nada.
const SEM_DONO = '__sem_dono__';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  leadName?: string | null;
  /** Ofertas já carregadas por quem abriu — evita uma segunda ida ao servidor. */
  offers?: BrokerAssignmentDetail[];
  /** Chamado depois de encerrar, para a lista/card recarregarem. */
  onDone?: () => void;
}

export default function RemoveFromRoletaDialog({
  open, onOpenChange, contactId, leadName, offers, onDone,
}: Props) {
  const { users } = useAccountUsers();
  const [destino, setDestino] = useState<string>(SEM_DONO);
  const [saving, setSaving]   = useState(false);
  const [emAberto, setEmAberto] = useState<BrokerAssignmentDetail[]>(offers ?? []);

  // Reabrir o diálogo não pode herdar a escolha da vez anterior — sem responsável
  // é o padrão porque é a opção que não entrega o lead a ninguém por acidente.
  useEffect(() => {
    if (!open) return;
    setDestino(SEM_DONO);
    if (offers?.length) { setEmAberto(offers); return; }
    brokerAssignmentsService.listForLead(contactId).then(setEmAberto).catch(() => setEmAberto([]));
  }, [open, contactId, offers]);

  const confirmar = async () => {
    setSaving(true);
    try {
      const escolhido = destino === SEM_DONO ? null : destino;
      const res = await brokerAssignmentsService.cancelForLead(contactId, escolhido);
      const nome = users.find(u => String(u.id) === escolhido)?.name;
      toast.success(
        res.cancelled > 0
          ? (nome ? `Lead fora da roleta e com ${nome}.` : 'Lead fora da roleta e sem responsável.')
          : 'Este lead já não tinha oferta em aberto.',
      );
      onOpenChange(false);
      onDone?.();
    } catch {
      toast.error('Não consegui tirar o lead da roleta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tirar da roleta</DialogTitle>
          <DialogDescription>
            {leadName ? <><strong>{leadName}</strong> sai do sorteio.</> : 'O lead sai do sorteio.'}
            {' '}O prazo de aceite para de correr e o corretor que estava com a oferta é avisado.
          </DialogDescription>
        </DialogHeader>

        {emAberto.length > 0 && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>
                {emAberto.length === 1 ? 'Oferta em aberto com ' : 'Ofertas em aberto com '}
                <strong>{emAberto.map(o => o.corretor ?? 'corretor').join(', ')}</strong>
              </span>
            </div>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label className="text-xs">Com quem o lead fica</Label>
          <Select value={destino} onValueChange={setDestino} disabled={saving}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_DONO}>Sem responsável — volta para o time</SelectItem>
              {users.map(u => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Sem responsável, o lead fica visível para todo mundo até alguém distribuir.
            Escolhendo um corretor, ele vira dono na hora, sem precisar aceitar.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tirar da roleta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
