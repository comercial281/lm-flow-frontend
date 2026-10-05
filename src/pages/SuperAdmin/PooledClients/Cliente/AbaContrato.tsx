// src/pages/SuperAdmin/PooledClients/Cliente/AbaContrato.tsx
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Input, Label } from '@/components/ui/ds';
import { clientesService } from '@/services/superAdmin/clientesService';
import { groupJidsFrom, groupsPatch } from '../clientGroups';
import type { PropsDaAba } from './Pagina';

// Contrato do cliente. 3A: os três limites (números de WhatsApp, franquia de
// leads da IA, preço do excedente). O PATCH reenvia os grupos de WhatsApp: o
// servidor faz compact! nessas chaves e uma omissão apagaria os grupos.
export default function AbaContrato({ cliente, aoMudar }: PropsDaAba) {
  const [numeros, setNumeros] = useState(String(cliente.max_whatsapp_channels ?? 5));
  const [franquia, setFranquia] = useState(cliente.ai_leads_included == null ? '' : String(cliente.ai_leads_included));
  const [preco, setPreco] = useState(String(cliente.ai_lead_overage_price_brl ?? 2.49));
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    try {
      const atualizado = await clientesService.atualizar(cliente.id, {
        name: cliente.name,
        ...groupsPatch(groupJidsFrom(cliente.settings ?? {})),
        max_whatsapp_channels: Math.max(0, parseInt(numeros, 10) || 0),
        ai_leads_included: franquia.trim() === '' ? null : Math.max(0, parseInt(franquia, 10) || 0),
        ai_lead_overage_price_brl: preco.trim() === '' ? null : Math.max(0, parseFloat(preco.replace(',', '.')) || 0),
      });
      aoMudar({ ...cliente, ...atualizado });
      toast.success('Limites salvos.');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Não deu pra salvar.');
    } finally { setSalvando(false); }
  };

  return (
    <section aria-labelledby="limites" className="max-w-xl rounded-lg border p-4">
      <h2 id="limites" className="mb-3 text-sm font-semibold">Limites</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><Label htmlFor="lim-num">Números de WhatsApp</Label><Input id="lim-num" inputMode="numeric" value={numeros} onChange={(e) => setNumeros(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">0 = ilimitado · em uso: {cliente.whatsapp_channels_used ?? '—'}</p></div>
        <div><Label htmlFor="lim-fr">Franquia de leads da IA</Label><Input id="lim-fr" inputMode="numeric" placeholder="sem franquia" value={franquia} onChange={(e) => setFranquia(e.target.value)} /></div>
        <div><Label htmlFor="lim-pr">Preço do excedente (R$)</Label><Input id="lim-pr" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} /></div>
      </div>
      <Button className="mt-3" disabled={salvando} onClick={() => void salvar()}>Salvar limites</Button>
    </section>
  );
}
