import { useState } from 'react';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label,
} from '@/components/ui/ds';

export default function JanelaPorEndereco({ aberta, aoFechar, aoAdicionar }: {
  aberta: boolean; aoFechar: () => void; aoAdicionar: (url: string) => Promise<boolean>;
}) {
  const [url, setUrl] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valido = /^https?:\/\/\S+$/i.test(url.trim());
  const enviar = async () => {
    setEnviando(true);
    const ok = await aoAdicionar(url);
    setEnviando(false);
    if (ok) { setUrl(''); aoFechar(); }
  };
  return (
    <Dialog open={aberta} onOpenChange={o => { if (!o) aoFechar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar por endereço da internet</DialogTitle>
          <DialogDescription>Cole o endereço de uma foto ou vídeo que já está na internet.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="foto-endereco">Endereço</Label>
          <Input id="foto-endereco" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button type="button" onClick={() => void enviar()} disabled={!valido || enviando}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
