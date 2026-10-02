// src/pages/Customer/Properties/lista/JanelaSituacao.tsx
import { useEffect, useState } from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/ds';
import type { Property } from '@/services/properties/propertiesService';
import { SITUACOES, rotuloDaSituacao, tipoDoImovel } from '@/features/properties/listingKind';

// A situação não muda mais direto no card (era fácil trocar sem querer rolando
// no celular). Aqui a pessoa escolhe, lê o efeito e salva.
export default function JanelaSituacao({ imovel, aoFechar, aoSalvar }: {
  imovel: Property | null; aoFechar: () => void; aoSalvar: (status: string) => Promise<void>;
}) {
  const [escolha, setEscolha] = useState('');
  const [salvando, setSalvando] = useState(false);
  // Depende do id e da situação, não do objeto: uma recarga da lista entrega um
  // objeto novo do mesmo imóvel e não pode apagar a escolha ainda não salva.
  useEffect(() => { setEscolha(imovel?.status ?? ''); }, [imovel?.id, imovel?.status]);
  if (!imovel) return null;
  const kind = tipoDoImovel(imovel);
  const efeito = kind === 'development'
    ? 'Esgotado ou inativo tira o empreendimento do site e dos portais.'
    : 'Vendido, alugado ou inativo tira o imóvel do site e dos portais.';

  return (
    <Dialog open onOpenChange={o => { if (!o && !salvando) aoFechar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Situação de {imovel.code}</DialogTitle>
          <DialogDescription>Hoje: {rotuloDaSituacao(kind, imovel.status)}. {efeito}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {SITUACOES[kind].map(s => (
            <button key={s.valor} type="button" aria-pressed={escolha === s.valor} onClick={() => setEscolha(s.valor)}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${escolha === s.valor ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-input'}`}>
              {s.rotulo}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar} disabled={salvando}>Cancelar</Button>
          <Button disabled={salvando || escolha === imovel.status}
            onClick={async () => { setSalvando(true); try { await aoSalvar(escolha); } finally { setSalvando(false); } }}>
            Salvar situação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
