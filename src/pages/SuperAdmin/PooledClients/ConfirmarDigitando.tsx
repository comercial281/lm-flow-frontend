import { useState } from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input } from '@/components/ui/ds';

// Confirmação que pede digitar um texto exato (excluir cliente, recomeçar a
// demonstração). O `useConfirmacao` da casa não tem campo de texto.
export default function ConfirmarDigitando({ aberto, titulo, descricao, esperado, rotuloDaAcao, aoConfirmar, aoFechar }: {
  aberto: boolean; titulo: string; descricao: string; esperado: string; rotuloDaAcao: string;
  aoConfirmar: () => Promise<void>; aoFechar: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ok = texto.trim() === esperado;
  const fechar = () => { setTexto(''); aoFechar(); };
  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) fechar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao} Para confirmar, digite <b>{esperado}</b>.</DialogDescription>
        </DialogHeader>
        <Input aria-label={`Digite ${esperado}`} value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={fechar}>Cancelar</Button>
          <Button variant="destructive" disabled={!ok || enviando}
            onClick={async () => { setEnviando(true); try { await aoConfirmar(); setTexto(''); } finally { setEnviando(false); } }}>
            {rotuloDaAcao}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
