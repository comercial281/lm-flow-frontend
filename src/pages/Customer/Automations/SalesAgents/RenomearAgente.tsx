// "Renomear" do "⋯" da barra (fase 6, tarefa 69): o nome interno do agente, o que
// aparece no seletor e nos quadros. Grava só o `name`, no clique em Salvar, e devolve
// a IA salva pelo `aoSalvo` (a casca atualiza a barra e a lista).
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label,
} from '@/components/ui/ds';
import { salesAgentsService, type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { motivoDaFalha } from '@/features/salesAgents/erroDoServidor';

export default function RenomearAgente({ agent, aoSalvo, aoFechar }: {
  agent: SalesAgent;
  aoSalvo: (a: SalesAgent) => void;
  aoFechar: () => void;
}) {
  const [nome, setNome] = useState(agent.name);
  const [gravando, setGravando] = useState(false);
  const limpo = nome.trim();

  const salvar = async () => {
    if (!limpo) return;
    if (limpo === agent.name) { aoFechar(); return; }
    setGravando(true);
    try {
      aoSalvo(await salesAgentsService.update(agent.id, { name: limpo }));
      aoFechar();
    } catch (e) {
      toast.error(motivoDaFalha(e, 'Não consegui renomear o agente.'));
    } finally {
      setGravando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !gravando) aoFechar(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Renomear agente</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); void salvar(); }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="renomear-agente">Nome do agente</Label>
            <Input id="renomear-agente" value={nome} maxLength={60} autoFocus onChange={(e) => setNome(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={aoFechar} disabled={gravando}>Cancelar</Button>
            <Button type="submit" disabled={!limpo || gravando}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
