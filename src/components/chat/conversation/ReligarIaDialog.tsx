import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button } from '@/components/ui/ds';
import EscolhaDoAgente from '@/components/base/EscolhaDoAgente';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';

// "Religar IA neste lead" num número dividido: qual agente volta a atender (fase 2, C81).
// Com um agente só no número a janela nem abre: quem chama liga direto.
const ReligarIaDialog: React.FC<{
  agentes: SalesAgent[];
  open: boolean;
  salvando?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (agenteId: string) => void;
}> = ({ agentes, open, salvando = false, onOpenChange, onConfirmar }) => {
  const [escolhido, setEscolhido] = useState<string | null>(null);
  useEffect(() => { if (open) setEscolhido(null); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Religar IA neste lead</DialogTitle>
          <DialogDescription>Este número é dividido entre agentes. Diga qual deles volta a atender este lead.</DialogDescription>
        </DialogHeader>
        <EscolhaDoAgente agentes={agentes} valor={escolhido} aoEscolher={setEscolhido} desabilitado={salvando} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={() => escolhido && onConfirmar(escolhido)} disabled={!escolhido || salvando}>Religar IA</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReligarIaDialog;
